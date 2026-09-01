import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  IDEMPOTENCY_KEY_HEADER,
} from "@showzy/contract";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { CompanyMembership } from "../features/companies/api/list-mine";

/** jsdom document origin — same-origin `/api/auth` and `/rpc`. */
export const PANEL_ORIGIN = "http://localhost:3000";

export type MockSessionUser = {
  readonly id: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
};

export type RpcCall = {
  readonly path: string;
  readonly companyId: string | null;
};

export type MutationRpcCall = {
  readonly path: string;
  readonly companyId: string | null;
  readonly idempotencyKey: string | null;
  readonly confirmationChallengeId: string | null;
  readonly input: unknown;
};

type SessionState = { user: MockSessionUser | null };

type RpcState = {
  memberships: CompanyMembership[];
  occupiedSlugs: string[];
  createNetworkFailuresRemaining: number;
  createConfirmationsRemaining: number;
  confirmationChallengeId: string;
  calls: RpcCall[];
  mutationCalls: MutationRpcCall[];
};

type SessionJson = {
  readonly session: {
    readonly id: string;
    readonly userId: string;
    readonly token: string;
    readonly expiresAt: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly emailVerified: boolean;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly phoneNumber: string | null;
  };
} | null;

type AuthMsw = {
  readonly sessionState: SessionState;
  readonly rpcState: RpcState;
  readonly server: ReturnType<typeof setupServer>;
  listening: boolean;
};

/**
 * Vitest `setupFiles` re-evaluate per file and `globalSetup` is a
 * different process. Keep one `setupServer` + session on `globalThis`
 * so `listen()` is once-per-worker and tests mutate the same session.
 */
function authMsw(): AuthMsw {
  const g = globalThis as typeof globalThis & { __showzyPanelMsw?: AuthMsw };
  const existing = g.__showzyPanelMsw;
  if (existing !== undefined) {
    return existing;
  }
  const sessionState: SessionState = { user: null };
  const rpcState: RpcState = {
    memberships: [],
    occupiedSlugs: [],
    createNetworkFailuresRemaining: 0,
    createConfirmationsRemaining: 0,
    confirmationChallengeId: "challenge-1",
    calls: [],
    mutationCalls: [],
  };
  const created: AuthMsw = {
    sessionState,
    rpcState,
    server: setupServer(...allHandlers(sessionState, rpcState)),
    listening: false,
  };
  g.__showzyPanelMsw = created;
  return created;
}

function sessionJson(sessionState: SessionState): SessionJson {
  if (sessionState.user === null) {
    return null;
  }
  const now = new Date().toISOString();
  const email = sessionState.user.email ?? "380671112233@phone.invalid";
  return {
    session: {
      id: "session-1",
      userId: sessionState.user.id,
      token: "session-token",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: sessionState.user.id,
      email,
      name: "",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      phoneNumber: sessionState.user.phoneNumber,
    },
  };
}

function rpcJson(data: unknown): Response {
  return HttpResponse.json({ json: data });
}

function recordRpc(rpcState: RpcState, request: Request): void {
  rpcState.calls.push({
    path: new URL(request.url).pathname,
    companyId: request.headers.get(COMPANY_SELECTOR_HEADER),
  });
}

function rpcError(
  code: string,
  status: number,
  message: string,
  data?: unknown,
): Response {
  const payload: {
    defined: true;
    code: string;
    status: number;
    message: string;
    data?: unknown;
  } = {
    defined: true,
    code,
    status,
    message,
  };
  if (data !== undefined) {
    payload.data = data;
  }
  return HttpResponse.json({ json: payload }, { status });
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function envelopeInput(body: unknown): unknown {
  const record = jsonObject(body);
  if (record === null) {
    return undefined;
  }
  return "json" in record ? record.json : body;
}

function prefixFromSlug(slug: string): string {
  const letters = slug
    .replace(/[^a-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
  return `${letters}XX`.slice(0, 2);
}

function membershipFromCreate(name: string, slug: string): CompanyMembership {
  return {
    membershipId: crypto.randomUUID(),
    role: "owner",
    company: {
      id: crypto.randomUUID(),
      name,
      slug,
      prefix: prefixFromSlug(slug),
    },
  };
}

function allHandlers(sessionState: SessionState, rpcState: RpcState) {
  return [
    http.get(`${PANEL_ORIGIN}/api/auth/get-session`, () => {
      return HttpResponse.json(sessionJson(sessionState));
    }),
    http.post(`${PANEL_ORIGIN}/api/auth/phone-number/send-otp`, () => {
      return HttpResponse.json({ status: true });
    }),
    http.post(`${PANEL_ORIGIN}/api/auth/sign-out`, () => {
      sessionState.user = null;
      return HttpResponse.json({ success: true });
    }),
    http.post(`${PANEL_ORIGIN}/api/auth/phone-number/verify`, () => {
      sessionState.user = {
        id: "user-1",
        email: null,
        phoneNumber: "+380671112233",
      };
      return HttpResponse.json(sessionJson(sessionState));
    }),
    http.post(
      `${PANEL_ORIGIN}/api/auth/email-otp/send-verification-otp`,
      () => {
        return HttpResponse.json({ status: true });
      },
    ),
    http.post(`${PANEL_ORIGIN}/api/auth/sign-in/email-otp`, () => {
      sessionState.user = {
        id: "user-1",
        email: "user@example.com",
        phoneNumber: null,
      };
      return HttpResponse.json(sessionJson(sessionState));
    }),
    http.post(`${PANEL_ORIGIN}/rpc/companies/listMine`, ({ request }) => {
      recordRpc(rpcState, request);
      return rpcJson({ memberships: rpcState.memberships });
    }),
    http.post(`${PANEL_ORIGIN}/rpc/companies/get`, ({ request }) => {
      recordRpc(rpcState, request);
      const companyId = request.headers.get(COMPANY_SELECTOR_HEADER);
      const current = rpcState.memberships.find(
        (membership) => membership.company.id === companyId,
      )?.company;
      return rpcJson({
        id: current?.id ?? "c0c0c0c0-0000-4000-8000-000000000099",
        name: current?.name ?? "unknown",
        slug: current?.slug ?? "unknown",
        prefix: current?.prefix ?? "XX",
        legal: null,
      });
    }),
    http.post(`${PANEL_ORIGIN}/rpc/companies/create`, async ({ request }) => {
      recordRpc(rpcState, request);
      const body: unknown = await request.json();
      const input = envelopeInput(body);
      rpcState.mutationCalls.push({
        path: new URL(request.url).pathname,
        companyId: request.headers.get(COMPANY_SELECTOR_HEADER),
        idempotencyKey: request.headers.get(IDEMPOTENCY_KEY_HEADER),
        confirmationChallengeId: request.headers.get(
          CONFIRMATION_CHALLENGE_HEADER,
        ),
        input,
      });
      if (rpcState.createNetworkFailuresRemaining > 0) {
        rpcState.createNetworkFailuresRemaining -= 1;
        return HttpResponse.error();
      }
      if (rpcState.createConfirmationsRemaining > 0) {
        rpcState.createConfirmationsRemaining -= 1;
        return rpcError(
          "CONFIRMATION_REQUIRED",
          409,
          "Confirmation required.",
          {
            challenge: {
              challengeId: rpcState.confirmationChallengeId,
              summary: "Create this company",
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
            },
          },
        );
      }
      const record = jsonObject(input);
      const name = typeof record?.name === "string" ? record.name.trim() : "";
      const slug = typeof record?.slug === "string" ? record.slug : "";
      if (name.length === 0 || slug.length === 0) {
        return rpcError("VALIDATION", 400, "Invalid.", { issues: [] });
      }
      const existing = rpcState.memberships.find(
        (membership) => membership.company.slug === slug,
      );
      if (existing !== undefined) {
        if (existing.company.name === name) {
          return rpcJson(existing);
        }
        return rpcError(
          "CONFLICT",
          409,
          "This company address is already taken.",
        );
      }
      if (rpcState.occupiedSlugs.includes(slug)) {
        return rpcError(
          "CONFLICT",
          409,
          "This company address is already taken.",
        );
      }
      const created = membershipFromCreate(name, slug);
      rpcState.memberships = [...rpcState.memberships, created];
      return rpcJson(created);
    }),
    http.post(
      `${PANEL_ORIGIN}/rpc/companies/updateLegal`,
      async ({ request }) => {
        recordRpc(rpcState, request);
        const body: unknown = await request.json();
        const input = envelopeInput(body);
        const companyId = request.headers.get(COMPANY_SELECTOR_HEADER);
        rpcState.mutationCalls.push({
          path: new URL(request.url).pathname,
          companyId,
          idempotencyKey: request.headers.get(IDEMPOTENCY_KEY_HEADER),
          confirmationChallengeId: request.headers.get(
            CONFIRMATION_CHALLENGE_HEADER,
          ),
          input,
        });
        const current = rpcState.memberships.find(
          (membership) => membership.company.id === companyId,
        )?.company;
        const record = jsonObject(input);
        const now = new Date().toISOString();
        return rpcJson({
          id: current?.id ?? "c0c0c0c0-0000-4000-8000-000000000099",
          name: current?.name ?? "unknown",
          slug: current?.slug ?? "unknown",
          prefix: current?.prefix ?? "XX",
          legal: {
            id: crypto.randomUUID(),
            companyType: record?.companyType ?? "fop",
            legalName:
              typeof record?.legalName === "string" ? record.legalName : null,
            edrpou: record?.edrpou ?? null,
            legalAddress: record?.legalAddress ?? null,
            iban: record?.iban ?? null,
            bankName: record?.bankName ?? null,
            bankMfo: record?.bankMfo ?? null,
            bankEdrpou: record?.bankEdrpou ?? null,
            phone: record?.phone ?? null,
            email: record?.email ?? null,
            createdAt: now,
            updatedAt: now,
          },
        });
      },
    ),
  ];
}

const msw = authMsw();

export const sessionState = msw.sessionState;
export const listMineState = msw.rpcState;
export const server = msw.server;

export function resetAuthMocks(): void {
  sessionState.user = null;
  listMineState.memberships = [];
  listMineState.occupiedSlugs = [];
  listMineState.createNetworkFailuresRemaining = 0;
  listMineState.createConfirmationsRemaining = 0;
  listMineState.confirmationChallengeId = "challenge-1";
  listMineState.calls = [];
  listMineState.mutationCalls = [];
}

export function ensureAuthServer(): void {
  if (msw.listening) {
    return;
  }
  server.listen({ onUnhandledRequest: "error" });
  msw.listening = true;
}
