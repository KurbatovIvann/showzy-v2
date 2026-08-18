/**
 * HTTP transport integration (contract.md §3/§7, security-operations §8):
 * session gate, principal dispatch, trusted-proxy IP, and OTP over the
 * mounted better-auth handler against Testcontainers Postgres.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { ORPCError } from "@orpc/client";
import { createContractClient, type ContractRouterFor } from "@showzy/contract";
import {
  ActionRegistry,
  createConfirmationHook,
  createInMemoryConfirmationStore,
  createInMemoryRateLimitStore,
  createRateLimitHook,
  effectiveCompanyId,
  implementAction,
  type ImplementedAction,
} from "@showzy/core";
import { defineActionContract } from "@showzy/core/contract";
import {
  createTestKit,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { session } from "@showzy/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { buildAuthOptions } from "../auth/options.js";
import { otpPolicy } from "../auth/policy.js";
import { createMemorySecondaryStorage } from "../stores/memory.js";
import {
  AUTH_PREFIX,
  createApp,
  REST_PREFIX,
  type AuthInstance,
} from "./app.js";

const PHONE_A = "+380671112233";
const PHONE_B = "+380509998877";
const INGRESS = "10.0.0.1";
const REAL_CLIENT = "203.0.113.50";
const SPOOF = "8.8.8.8";
const PEER_UNTRUSTED = "198.51.100.10";

const readDefaults = {
  transport: "client" as const,
  aiExposure: "internal" as const,
  risk: "read" as const,
  requiresConfirmation: false,
  idempotent: false,
  emits: [] as const,
  atomicCalls: [] as const,
  atomicCallers: [] as const,
  audit: false,
  timeout: 5_000,
};

const scopeOutput = z.object({
  companyId: z.string().nullable(),
  clientIp: z.string(),
});

function createSampleActions() {
  return {
    plan: implementAction(
      defineActionContract({
        ...readDefaults,
        name: "sample.plan",
        description: "Staff read echoing the verified company scope.",
        principal: "staff",
        permissions: ["sample:view"],
        input: z.object({}),
        output: scopeOutput,
      }),
      {
        handler: (_input, ctx) =>
          Promise.resolve({
            companyId: effectiveCompanyId(ctx),
            clientIp: ctx.clientIp ?? "",
          }),
      },
    ),
    discover: implementAction(
      defineActionContract({
        ...readDefaults,
        name: "sample.discover",
        description: "Anonymous global discovery over the fixture grant.",
        principal: "public",
        publicScope: "globalProjection",
        projectionGrant: "fixture.discovery",
        permissions: [],
        input: z.object({}),
        output: scopeOutput,
      }),
      {
        handler: (_input, ctx) =>
          Promise.resolve({
            companyId: effectiveCompanyId(ctx),
            clientIp: ctx.clientIp ?? "",
          }),
      },
    ),
    whoami: implementAction(
      defineActionContract({
        ...readDefaults,
        name: "sample.whoami",
        description: "Consumer read proving the null company scope.",
        principal: "consumer",
        permissions: [],
        input: z.object({}),
        output: scopeOutput,
      }),
      {
        handler: (_input, ctx) =>
          Promise.resolve({
            companyId: effectiveCompanyId(ctx),
            clientIp: ctx.clientIp ?? "",
          }),
      },
    ),
    mine: implementAction(
      defineActionContract({
        ...readDefaults,
        name: "sample.mine",
        description: "Account read proving the null company scope.",
        principal: "account",
        permissions: [],
        input: z.object({}),
        output: scopeOutput,
      }),
      {
        handler: (_input, ctx) =>
          Promise.resolve({
            companyId: effectiveCompanyId(ctx),
            clientIp: ctx.clientIp ?? "",
          }),
      },
    ),
  };
}

function createExposed(actions: ReturnType<typeof createSampleActions>) {
  return {
    sample: {
      plan: actions.plan.contract,
      discover: actions.discover.contract,
      whoami: actions.whoami.contract,
      mine: actions.mine.contract,
    },
  };
}

type SampleRouter = ContractRouterFor<ReturnType<typeof createExposed>>;

function register(
  registry: ActionRegistry,
  action: ImplementedAction<z.ZodType, z.ZodType, unknown>,
): void {
  registry.registerContract(action.contract);
  registry.registerImplementation(action);
}

function toAuthInstance(auth: {
  handler: AuthInstance["handler"];
  api: {
    getSession: (args: {
      headers: Headers;
    }) => Promise<{ user: { id: string } } | null | undefined>;
  };
}): AuthInstance {
  return {
    handler: (request) => auth.handler(request),
    api: {
      async getSession({ headers }) {
        const result = await auth.api.getSession({ headers });
        if (result === null || result === undefined) {
          return null;
        }
        return { user: { id: result.user.id } };
      },
    },
  };
}

async function insertBearer(kit: TestKit, userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  await kit.db.runtime.db.insert(session).values({
    id: randomUUID(),
    token,
    userId,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  });
  return token;
}

function tokenFromVerify(response: Response, payload: unknown): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "token" in payload &&
    typeof payload.token === "string" &&
    payload.token !== ""
  ) {
    return payload.token;
  }
  return (
    response.headers.get("set-auth-token") ??
    response.headers.get("set-auth-jwt")
  );
}

let kit: TestKit;
let app: ReturnType<typeof createApp>;
let sentPhone: { phoneNumber: string; code: string }[];
let nowMs: number;

function advanceSeconds(seconds: number): void {
  nowMs += seconds * 1000;
}

beforeAll(async () => {
  kit = await createTestKit();
  sentPhone = [];
  nowMs = Date.parse("2026-08-18T12:00:00Z");
  const secondary = createMemorySecondaryStorage({ now: () => nowMs });
  const auth = betterAuth(
    buildAuthOptions({
      database: drizzleAdapter(kit.db.runtime.db, { provider: "pg" }),
      baseUrl: "http://localhost:3000",
      secret: "test-only-secret-0123456789abcdef-0000",
      sendPhoneOtp: (data) => {
        sentPhone.push(data);
        return Promise.resolve();
      },
      sendEmailOtp: () => Promise.resolve(),
      otpSendStore: secondary,
      secondaryStorage: secondary,
      now: () => nowMs,
    }),
  );
  const actions = createSampleActions();
  const registry = new ActionRegistry();
  register(registry, actions.plan);
  register(registry, actions.discover);
  register(registry, actions.whoami);
  register(registry, actions.mine);

  app = createApp({
    auth: toAuthInstance(auth),
    registry,
    contractModules: createExposed(actions),
    pipeline: {
      ...kit.pipeline,
      hooks: {
        ...kit.pipeline.hooks,
        rateLimit: createRateLimitHook({
          store: createInMemoryRateLimitStore(),
          ipHmacSecret: "test-ip-hmac-secret",
          logger: kit.pipeline.logger,
        }),
        confirmation: createConfirmationHook({
          store: createInMemoryConfirmationStore(),
        }),
      },
    },
    trustedProxies: [INGRESS],
    getPeerAddress: (c) => c.req.header("x-test-peer-address") ?? "127.0.0.1",
  });
});

afterAll(async () => {
  await kit.db.close();
});

function rpcClient(options: {
  readonly token?: string | null;
  readonly companyId?: string | null;
  readonly extraHeaders?: Record<string, string>;
}): ReturnType<typeof createContractClient<SampleRouter>>["client"] {
  return createContractClient<SampleRouter>({
    baseUrl: "http://localhost:3000",
    ...(options.token !== undefined && options.token !== null
      ? { getAccessToken: () => options.token }
      : {}),
    ...(options.companyId !== undefined
      ? { initialCompanyId: options.companyId }
      : {}),
    fetch: async (request) => {
      if (options.extraHeaders === undefined) {
        return app.request(request);
      }
      const headers = new Headers(request.headers);
      for (const [name, value] of Object.entries(options.extraHeaders)) {
        headers.set(name, value);
      }
      return app.request(new Request(request, { headers }));
    },
  }).client;
}

async function expectOrpcError(
  promise: Promise<unknown>,
): Promise<ORPCError<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    if (error instanceof ORPCError) {
      return error;
    }
  }
  throw new Error("expected the invocation to fail with an oRPC error");
}

async function authPost(
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
): Promise<Response> {
  return app.request(`http://localhost:3000${AUTH_PREFIX}${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...extra,
    },
    body: JSON.stringify(body),
  });
}

describe("contract.md §7 principal dispatch over HTTP", () => {
  it("no session on a staff action → 401 UNAUTHORIZED", async () => {
    const error = await expectOrpcError(rpcClient({}).sample.plan({}));
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.status).toBe(401);
  });

  it("x-company-id without membership → 403 PERMISSION_DENIED", async () => {
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const error = await expectOrpcError(
      rpcClient({
        token,
        companyId: kitIdentities.companies.b,
      }).sample.plan({}),
    );
    expect(error.code).toBe("PERMISSION_DENIED");
    expect(error.status).toBe(403);
  });

  it("staff with membership succeeds under the verified selector", async () => {
    const token = await insertBearer(kit, kitIdentities.users.anna);
    await expect(
      rpcClient({
        token,
        companyId: kitIdentities.companies.a,
      }).sample.plan({}),
    ).resolves.toMatchObject({ companyId: kitIdentities.companies.a });
  });

  it("public-global without a session succeeds and ignores x-company-id", async () => {
    await expect(
      rpcClient({ companyId: kitIdentities.companies.a }).sample.discover({}),
    ).resolves.toMatchObject({ companyId: null });
  });

  it("consumer with a session succeeds; a present selector grants no company", async () => {
    const token = await insertBearer(kit, kitIdentities.users.anna);
    await expect(
      rpcClient({
        token,
        companyId: kitIdentities.companies.a,
      }).sample.whoami({}),
    ).resolves.toMatchObject({ companyId: null });
  });

  it("account with a session succeeds; a present selector grants no company", async () => {
    const token = await insertBearer(kit, kitIdentities.users.boris);
    await expect(
      rpcClient({
        token,
        companyId: kitIdentities.companies.b,
      }).sample.mine({}),
    ).resolves.toMatchObject({ companyId: null });
  });

  it("consumer without a session → 401", async () => {
    const error = await expectOrpcError(rpcClient({}).sample.whoami({}));
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.status).toBe(401);
  });

  it("account without a session → 401", async () => {
    const error = await expectOrpcError(rpcClient({}).sample.mine({}));
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.status).toBe(401);
  });

  it("OpenAPI REST alias at /api/v1 serves the same public action", async () => {
    const response = await app.request(
      `http://localhost:3000${REST_PREFIX}/sample/discover`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ companyId: null });
  });
});

describe("trusted-proxy IP (security-operations §2)", () => {
  it("ignores a spoofed X-Forwarded-For from an untrusted peer", async () => {
    const result = await rpcClient({
      extraHeaders: {
        "x-test-peer-address": PEER_UNTRUSTED,
        "x-forwarded-for": SPOOF,
      },
    }).sample.discover({});
    expect(result.clientIp).toBe(PEER_UNTRUSTED);
  });

  it("uses X-Forwarded-For when the peer is a trusted ingress", async () => {
    const result = await rpcClient({
      extraHeaders: {
        "x-test-peer-address": INGRESS,
        "x-forwarded-for": REAL_CLIENT,
      },
    }).sample.discover({});
    expect(result.clientIp).toBe(REAL_CLIENT);
  });
});

describe("OTP over HTTP (security-operations §8)", () => {
  it("responds identically for known and unknown phones (non-enumeration)", async () => {
    const first = await authPost("/phone-number/send-otp", {
      phoneNumber: PHONE_A,
    });
    const second = await authPost("/phone-number/send-otp", {
      phoneNumber: PHONE_B,
    });
    expect(first.status).toBe(second.status);
    const firstBody: unknown = await first.json();
    const secondBody: unknown = await second.json();
    expect(firstBody).toEqual(secondBody);
    expect(sentPhone).toHaveLength(2);
    const code = sentPhone[0]?.code ?? "";
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(firstBody)).not.toContain(code);
  });

  it("enforces the 60-second resend cooldown over HTTP", async () => {
    const phone = "+380671000001";
    expect(
      (await authPost("/phone-number/send-otp", { phoneNumber: phone })).status,
    ).toBe(200);
    expect(
      (await authPost("/phone-number/send-otp", { phoneNumber: phone })).status,
    ).toBe(429);
    advanceSeconds(otpPolicy.resendCooldownSeconds);
    expect(
      (await authPost("/phone-number/send-otp", { phoneNumber: phone })).status,
    ).toBe(200);
  });

  it("invalidates the code after 5 failed verification attempts", async () => {
    const phone = "+380671000002";
    await authPost("/phone-number/send-otp", { phoneNumber: phone });
    const code = sentPhone.at(-1)?.code ?? "";
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < otpPolicy.maxVerifyAttempts; i += 1) {
      const failed = await authPost("/phone-number/verify", {
        phoneNumber: phone,
        code: wrong,
      });
      expect(failed.status).toBeGreaterThanOrEqual(400);
    }
    const blocked = await authPost("/phone-number/verify", {
      phoneNumber: phone,
      code: wrong,
    });
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    const dead = await authPost("/phone-number/verify", {
      phoneNumber: phone,
      code,
    });
    expect(dead.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects a code after the 5-minute expiry", async () => {
    const phone = "+380671000003";
    const originalNow = Date.now;
    Date.now = () => nowMs;
    try {
      await authPost("/phone-number/send-otp", { phoneNumber: phone });
      const code = sentPhone.at(-1)?.code ?? "";
      advanceSeconds(otpPolicy.expirySeconds + 1);
      const expired = await authPost("/phone-number/verify", {
        phoneNumber: phone,
        code,
      });
      expect(expired.status).toBeGreaterThanOrEqual(400);
    } finally {
      Date.now = originalNow;
    }
  });

  it("a successful verify issues a bearer that can invoke an account action", async () => {
    const phone = "+380671000004";
    await authPost("/phone-number/send-otp", { phoneNumber: phone });
    const code = sentPhone.at(-1)?.code ?? "";
    const verified = await authPost("/phone-number/verify", {
      phoneNumber: phone,
      code,
    });
    expect(verified.status).toBe(200);
    const payload: unknown = await verified.json();
    const bearer = tokenFromVerify(verified, payload);
    expect(bearer).toBeTruthy();
    await expect(
      rpcClient({ token: bearer }).sample.mine({}),
    ).resolves.toMatchObject({ companyId: null });
  });
});
