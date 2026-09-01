/**
 * Staff AI SSE mount (SHO-322): session/company denial, mock-model parity,
 * audit channel, confirmation resume, and `/rpc` remaining `ui`.
 */
import { randomBytes, randomUUID } from "node:crypto";

import {
  isStaffAssistantConfirmationOutput,
  type LanguageModel,
} from "@showzy/ai";
import {
  MockLanguageModelV3,
  mockTextStream,
  mockToolCallStream,
  readUiMessageSsePayloads,
} from "@showzy/ai/test";
import { createConversation } from "@showzy/assistant";
import { createProduct } from "@showzy/catalog";
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  contractModules,
  createContractClient,
  createMutationAttempt,
} from "@showzy/contract";
import {
  createConfirmationHook,
  createInMemoryConfirmationStore,
  createInMemoryRateLimitStore,
  executeAction,
  type ImplementedAction,
} from "@showzy/core";
import { NotFoundError } from "@showzy/core/errors";
import {
  createCapturingLogger,
  createTestKit,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import {
  archiveCustomer,
  createCustomer,
  getCustomer,
} from "@showzy/customers";
import { auditLog } from "@showzy/db";
import { session } from "@showzy/db/schema/auth";
import {
  assistantMessages,
  assistantToolRuns,
} from "@showzy/db/schema/assistant";
import { companyCustomers } from "@showzy/db/schema/customers";
import { orders } from "@showzy/db/schema/orders";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { buildAuthOptions } from "../auth/options.js";
import { createAtomicOtpSendStore } from "../auth/otp-send-guard.js";
import { createActionRegistry } from "../composition.js";
import {
  createMemoryAuthRateLimitStore,
  createMemorySecondaryStorage,
} from "../stores/memory.js";
import {
  createApp,
  HTTP_INVOCATION_CHANNEL,
  type AuthInstance,
} from "./app.js";
import {
  ASSISTANT_CHAT_PATH,
  ASSISTANT_INVOCATION_CHANNEL,
} from "./assistant-chat.js";
import { REQUEST_ID_HEADER } from "./request-id.js";

const REAL_CLIENT = "203.0.113.50";

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

function userChatBody(conversationId: string, text: string) {
  return {
    conversationId,
    messages: [
      {
        id: randomUUID(),
        role: "user" as const,
        parts: [{ type: "text" as const, text }],
      },
    ],
  };
}

async function waitFor(
  predicate: () => Promise<boolean>,
  label: string,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
  }
  throw new Error(`timed out waiting for ${label}`);
}

let kit: TestKit;
let auth: AuthInstance;
let registry: ReturnType<typeof createActionRegistry>;
let pipeline: TestKit["pipeline"];

beforeAll(async () => {
  kit = await createTestKit();
  const secondary = createMemorySecondaryStorage();
  const better = betterAuth(
    buildAuthOptions({
      database: drizzleAdapter(kit.db.runtime.db, { provider: "pg" }),
      baseUrl: "http://localhost:3000",
      webOrigins: [],
      secret: "test-only-secret-0123456789abcdef-0000",
      sendPhoneOtp: () => Promise.resolve(),
      sendEmailOtp: () => Promise.resolve(),
      otpSendStore: createAtomicOtpSendStore(secondary),
      authRateLimitStore: createMemoryAuthRateLimitStore({
        ipHmacSecret: "test-ip-hmac-secret",
      }),
      secondaryStorage: secondary,
    }),
  );
  auth = toAuthInstance(better);
  registry = createActionRegistry();
  pipeline = {
    ...kit.pipeline,
    hooks: {
      ...kit.pipeline.hooks,
      confirmation: createConfirmationHook({
        store: createInMemoryConfirmationStore(),
      }),
    },
  };
});

afterAll(async () => {
  await kit.db.close();
});

function chatApp(model?: LanguageModel) {
  return createApp({
    auth,
    registry,
    contractModules,
    pipeline,
    trustedProxies: [],
    getPeerAddress: () => REAL_CLIENT,
    pkiProxy: {
      rateLimitStore: createInMemoryRateLimitStore(),
      ipHmacSecret: "test-pki-proxy-ip-hmac-secret!!",
    },
    assistant: {
      model: "mock",
      ...(model !== undefined ? { languageModel: model } : {}),
    },
  });
}

async function staffInvoke<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  action: ImplementedAction<TInput, TOutput, TTarget>,
  input: unknown,
  actor: { userId: string; companyId: string } = {
    userId: kitIdentities.users.anna,
    companyId: kitIdentities.companies.a,
  },
): Promise<z.output<TOutput>> {
  return executeAction(pipeline, {
    action,
    input,
    request: {
      requestId: randomUUID(),
      correlationId: randomUUID(),
      channel: "ui",
      clientIp: REAL_CLIENT,
      idempotencyKey: randomUUID(),
    },
    principal: {
      mode: "staff",
      session: { userId: actor.userId },
      companySelector: actor.companyId,
    },
  });
}

async function postChat(
  app: ReturnType<typeof createApp>,
  options: {
    readonly token?: string;
    readonly companyId?: string | null;
    readonly body: unknown;
    readonly challengeId?: string;
    readonly extraHeaders?: Record<string, string>;
  },
): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://localhost:3000",
  });
  if (options.token !== undefined) {
    headers.set("authorization", `Bearer ${options.token}`);
  }
  if (options.companyId !== undefined && options.companyId !== null) {
    headers.set(COMPANY_SELECTOR_HEADER, options.companyId);
  }
  if (options.challengeId !== undefined) {
    headers.set(CONFIRMATION_CHALLENGE_HEADER, options.challengeId);
  }
  if (options.extraHeaders !== undefined) {
    for (const [name, value] of Object.entries(options.extraHeaders)) {
      headers.set(name, value);
    }
  }
  return app.request(`http://localhost:3000${ASSISTANT_CHAT_PATH}`, {
    method: "POST",
    headers,
    body: JSON.stringify(options.body),
  });
}

describe("POST /assistant/chat authorization", () => {
  it("denies unauthenticated, missing company, and foreign company", async () => {
    const app = chatApp();
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Auth",
    });
    const body = userChatBody(conversation.id, "List orders");

    const unauthenticated = await postChat(app, { body });
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });

    const missingCompany = await postChat(app, { token, body });
    expect(missingCompany.status).toBe(403);
    expect(await missingCompany.json()).toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
    });

    const foreign = await postChat(app, {
      token,
      companyId: kitIdentities.companies.b,
      body,
    });
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
    });
  });

  it("isolates a foreign-company conversation as not-found", async () => {
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [mockTextStream("should not run")],
      }),
    );
    const anna = await insertBearer(kit, kitIdentities.users.anna);
    const borsConversation = await staffInvoke(
      createConversation,
      { title: "Boris" },
      {
        userId: kitIdentities.users.boris,
        companyId: kitIdentities.companies.b,
      },
    );
    const response = await postChat(app, {
      token: anna,
      companyId: kitIdentities.companies.a,
      body: userChatBody(borsConversation.id, "Hello from Anna"),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("fails typed when Anthropic is not configured after auth", async () => {
    const app = chatApp();
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "No key",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "AI_NOT_CONFIGURED",
      status: 503,
    });
  });
});

describe("POST /assistant/chat mock-model parity", () => {
  it("runs orders.list as a read tool", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream("call-list", "orders.list", "{}"),
          mockTextStream("You have no orders."),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "List",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(response.status).toBe(200);
    const payloads = await readUiMessageSsePayloads(response);
    expect(JSON.stringify(payloads)).toContain("You have no orders.");
    await waitFor(async () => {
      const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
      return runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list" &&
          run.outcome === "success",
      );
    }, "orders.list tool run");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("executes orders.create without confirmation", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI Order Buyer",
      phone: "+380671110001",
    });
    const product = await staffInvoke(createProduct, {
      name: "AI Cake",
      basePriceMinor: "15000",
    });
    const createInput = JSON.stringify({
      customerId: customer.id,
      items: [{ productId: product.productId, quantityMilli: "1000" }],
    });
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream("call-create", "orders.create", createInput),
          mockTextStream("Order created."),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Create",
    });
    const requestId = randomUUID();
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Create an order"),
      extraHeaders: { [REQUEST_ID_HEADER]: requestId },
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    await waitFor(async () => {
      const rows = await kit.db.runtime.db.select().from(orders);
      return rows.some(
        (row) =>
          row.companyId === kitIdentities.companies.a &&
          row.customerId === customer.id,
      );
    }, "created order row");

    const audit = await kit.db.runtime.db.select().from(auditLog);
    const aiRow = audit.find(
      (row) => row.action === "orders.create" && row.requestId === requestId,
    );
    expect(aiRow).toMatchObject({
      channel: ASSISTANT_INVOCATION_CHANNEL,
      aiTraceId: requestId,
      toolCallId: "call-create",
      actorType: "user",
      actorId: kitIdentities.users.anna,
      companyId: kitIdentities.companies.a,
      outcome: "ok",
    });
    expect(JSON.stringify(aiRow)).not.toContain("Create an order");
  });

  it("pauses customers.deleteCustomer and resumes with the Redis challenge", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI Delete Me",
      phone: "+380671110002",
    });
    await staffInvoke(archiveCustomer, { id: customer.id });
    const deleteInput = JSON.stringify({ id: customer.id });
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream(
            "call-delete",
            "customers.deleteCustomer",
            deleteInput,
          ),
          mockToolCallStream(
            "call-delete-resume",
            "customers.deleteCustomer",
            deleteInput,
          ),
          mockTextStream("The customer was deleted."),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Delete",
    });
    const pause = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
    });
    expect(pause.status).toBe(200);
    const pausePayloads = await readUiMessageSsePayloads(pause);
    const confirmation = pausePayloads
      .map((payload) => {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "type" in payload &&
          payload.type === "data-confirmation" &&
          "data" in payload
        ) {
          return payload.data;
        }
        return undefined;
      })
      .find((data) => isStaffAssistantConfirmationOutput(data));
    expect(confirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(confirmation)) {
      expect.unreachable("expected confirmation part");
    }
    expect(confirmation.summary).toContain("Delete this archived customer");
    expect(JSON.stringify(pausePayloads)).not.toContain(
      "The customer was deleted.",
    );

    const stillThere = (
      await kit.db.runtime.db.select().from(companyCustomers)
    ).filter((row) => row.id === customer.id);
    expect(stillThere).toHaveLength(1);

    const resume = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
      challengeId: confirmation.challengeId,
    });
    expect(resume.status).toBe(200);
    await readUiMessageSsePayloads(resume);

    await waitFor(async () => {
      const rows = await kit.db.runtime.db.select().from(companyCustomers);
      return !rows.some((row) => row.id === customer.id);
    }, "deleted customer");

    await expect(
      staffInvoke(getCustomer, { id: customer.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("POST /assistant/chat logs and /rpc channel", () => {
  it("does not log prompts, API keys, cookies, or OTP", async () => {
    const capturing = createCapturingLogger();
    const app = createApp({
      auth,
      registry,
      contractModules,
      pipeline: { ...pipeline, logger: capturing.logger },
      trustedProxies: [],
      getPeerAddress: () => REAL_CLIENT,
      pkiProxy: {
        rateLimitStore: createInMemoryRateLimitStore(),
        ipHmacSecret: "test-pki-proxy-ip-hmac-secret!!",
      },
      assistant: {
        model: "mock",
        languageModel: new MockLanguageModelV3({
          doStream: [mockTextStream("ok")],
        }),
      },
    });
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Logs",
    });
    const prompt = "PROMPT_SENTINEL_sho322_never_log OTP 111222";
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, prompt),
      extraHeaders: {
        cookie: "session=COOKIESECRET_sho322",
        "x-api-key": "sk-ant-TESTKEY-never-log",
      },
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    await waitFor(async () => {
      const rows = await kit.db.runtime.db.select().from(assistantMessages);
      return rows.some(
        (row) =>
          row.conversationId === conversation.id && row.role === "assistant",
      );
    }, "assistant persist");

    const blob = JSON.stringify(capturing.entries());
    expect(blob).not.toContain(prompt);
    expect(blob).not.toContain("COOKIESECRET_sho322");
    expect(blob).not.toContain("sk-ant-TESTKEY-never-log");
    expect(blob).not.toContain("111222");
    expect(blob).not.toContain("ANTHROPIC_API_KEY");
  });

  it("keeps /rpc labeled ui while the AI mount uses ai", async () => {
    expect(HTTP_INVOCATION_CHANNEL).toBe("ui");
    expect(ASSISTANT_INVOCATION_CHANNEL).toBe("ai");
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [mockTextStream("ok")],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const { client } = createContractClient({
      baseUrl: "http://localhost:3000",
      getAccessToken: () => token,
      initialCompanyId: kitIdentities.companies.a,
      fetch: async (request) => app.request(request),
    });
    const attempt = createMutationAttempt();
    const created = await client.assistant.createConversation(
      { title: "rpc-ui" },
      attempt.options,
    );
    const rows = await kit.db.runtime.db.select().from(auditLog);
    const rpcRow = rows.find(
      (row) =>
        row.action === "assistant.createConversation" &&
        row.targetId === created.id,
    );
    expect(rpcRow?.channel).toBe("ui");
    expect(rpcRow?.aiTraceId).toBeNull();
    expect(rpcRow?.toolCallId).toBeNull();
  });
});
