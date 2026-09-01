import { COMPANY_SELECTOR_HEADER } from "@showzy/contract";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { CompanyMembership } from "../api/companies/company-membership-query";

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

type SessionState = { user: MockSessionUser | null };

type RpcState = {
  memberships: CompanyMembership[];
  calls: RpcCall[];
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
  const rpcState: RpcState = { memberships: [], calls: [] };
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
  ];
}

const msw = authMsw();

export const sessionState = msw.sessionState;
export const listMineState = msw.rpcState;
export const server = msw.server;

export function resetAuthMocks(): void {
  sessionState.user = null;
  listMineState.memberships = [];
  listMineState.calls = [];
}

export function ensureAuthServer(): void {
  if (msw.listening) {
    return;
  }
  server.listen({ onUnhandledRequest: "error" });
  msw.listening = true;
}
