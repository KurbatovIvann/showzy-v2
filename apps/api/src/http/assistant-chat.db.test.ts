/**
 * Staff AI SSE mount (SHO-322): session/company denial, mock-model parity,
 * audit channel, confirmation resume, and `/rpc` remaining `ui`.
 */
import { randomBytes, randomUUID } from "node:crypto";

import {
  attemptKey,
  isStaffAssistantConfirmationOutput,
  ORDERS_LIST_COUNTS_TOOL_NAME,
  ORDERS_LIST_PAGE_TOOL_NAME,
  STAFF_ASSISTANT_MODEL_HISTORY_MAX,
  STAFF_ASSISTANT_TOOL_SEARCH_NAME,
  toProviderToolName,
  type LanguageModel,
  type StaffAssistantConfirmationOutput,
} from "@showzy/ai";
import {
  MockLanguageModelV3,
  mockOperationalGateGenerate,
  mockTextStream,
  mockToolCallStream,
  readUiMessageSsePayloads,
} from "@showzy/ai/test";
import { createConversation, recordAssistantTurn } from "@showzy/assistant";
import { createProduct } from "@showzy/catalog";
import { createOrder } from "@showzy/orders";
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
  createGroup,
  getCustomer,
} from "@showzy/customers";
import { auditLog, idempotencyKeys } from "@showzy/db";
import { session } from "@showzy/db/schema/auth";
import {
  assistantMessages,
  assistantToolRuns,
} from "@showzy/db/schema/assistant";
import { companyCustomers, customerGroups } from "@showzy/db/schema/customers";
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

function userChatBody(
  conversationId: string,
  text: string,
  messageId: string = randomUUID(),
) {
  return {
    conversationId,
    messages: [
      {
        id: messageId,
        role: "user" as const,
        parts: [{ type: "text" as const, text }],
      },
    ],
  };
}

function confirmationFromSsePayloads(
  payloads: unknown[],
): StaffAssistantConfirmationOutput | undefined {
  for (const payload of payloads) {
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("type" in payload) ||
      payload.type !== "data-confirmation" ||
      !("data" in payload)
    ) {
      continue;
    }
    if (isStaffAssistantConfirmationOutput(payload.data)) {
      return payload.data;
    }
  }
  return undefined;
}

function resumeBodyWithConfirmation(
  conversationId: string,
  text: string,
  confirmation: StaffAssistantConfirmationOutput,
) {
  return {
    conversationId,
    messages: [
      {
        id: randomUUID(),
        role: "user" as const,
        parts: [{ type: "text" as const, text }],
      },
      {
        id: randomUUID(),
        role: "assistant" as const,
        parts: [
          {
            type: "data-confirmation" as const,
            data: confirmation,
          },
        ],
      },
    ],
  };
}

async function userMessageCount(conversationId: string): Promise<number> {
  const rows = await kit.db.runtime.db.select().from(assistantMessages);
  return rows.filter(
    (row) => row.conversationId === conversationId && row.role === "user",
  ).length;
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

function chatApp(model?: LanguageModel, gateLanguageModel?: LanguageModel) {
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
      gateModel: "mock-gate",
      ...(model !== undefined ? { languageModel: model } : {}),
      ...(gateLanguageModel !== undefined ? { gateLanguageModel } : {}),
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

  it("injects persisted catalog.listProducts ids into the next stream prompt", async () => {
    const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const model = new MockLanguageModelV3({
      doStream: [mockTextStream("Those products are already known.")],
    });
    const app = chatApp(model);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Working set",
    });
    await staffInvoke(recordAssistantTurn, {
      conversationId: conversation.id,
      body: "Listed products.",
      toolRuns: [
        {
          actionName: "catalog.listProducts",
          toolCallId: "call-list-products",
          resultIds: [productId],
          outcome: "success",
        },
      ],
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "What are those products?"),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt ?? []);
    expect(prompt).toContain("catalog.listProducts");
    expect(prompt).toContain(productId);
    expect(prompt).toContain(
      "Do not call a list tool solely to recover these ids",
    );
  });

  it("omits the working-set addendum when the conversation has no tool runs", async () => {
    const model = new MockLanguageModelV3({
      doStream: [mockTextStream("I only help with this company.")],
    });
    const app = chatApp(model);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Empty runs",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Hello"),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt ?? []);
    expect(prompt).not.toContain("Working set from earlier tool runs");
  });

  it("windows 20 client messages to 8 and does not log dropped text", async () => {
    const dropped = "DROPPED_HISTORY_SENTINEL_sho349";
    const latest = "LATEST_USER_SENTINEL_sho349";
    const capturing = createCapturingLogger();
    const model = new MockLanguageModelV3({
      doStream: [mockTextStream("ASSISTANT_BODY_SENTINEL_never_log")],
    });
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
        gateModel: "mock-gate",
        languageModel: model,
      },
    });
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "History window",
    });
    const messages = Array.from({ length: 20 }, (_, index) => {
      const id = `m${String(index)}`;
      if (index % 2 === 0) {
        return {
          id,
          role: "assistant" as const,
          parts: [
            {
              type: "text" as const,
              text: index === 0 ? dropped : `assistant-${String(index)}`,
            },
          ],
        };
      }
      return {
        id,
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: index === 19 ? latest : `user-${String(index)}`,
          },
        ],
      };
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: { conversationId: conversation.id, messages },
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt ?? []);
    const conversationTurns = (model.doStreamCalls[0]?.prompt ?? []).filter(
      (part) => part.role === "user" || part.role === "assistant",
    );
    expect(conversationTurns).toHaveLength(STAFF_ASSISTANT_MODEL_HISTORY_MAX);
    expect(prompt).toContain(latest);
    expect(prompt).not.toContain(dropped);
    const usage = capturing
      .entries()
      .find((entry) => entry["msg"] === "staff assistant turn usage");
    expect(usage?.["history_message_count"]).toBe(
      STAFF_ASSISTANT_MODEL_HISTORY_MAX,
    );
    expect(JSON.stringify(usage)).not.toContain(dropped);
    expect(JSON.stringify(usage)).not.toContain(latest);
    expect(JSON.stringify(usage)).not.toContain(
      "ASSISTANT_BODY_SENTINEL_never_log",
    );
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
          mockToolCallStream("call-list", ORDERS_LIST_PAGE_TOOL_NAME, "{}"),
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

  it("eval 1: active-order product quantities use one orders_list_counts", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI Eval Counts Buyer",
      phone: "+380671110021",
    });
    const product = await staffInvoke(createProduct, {
      name: "AI Eval Widget",
      basePriceMinor: "1000",
    });
    await staffInvoke(createOrder, {
      customer: { by: "id", id: customer.id },
      items: [
        {
          product: { by: "id", id: product.productId },
          quantity: { milli: "1000" },
        },
      ],
    });
    await staffInvoke(createOrder, {
      customer: { by: "id", id: customer.id },
      items: [
        {
          product: { by: "id", id: product.productId },
          quantity: { milli: "3000" },
        },
      ],
    });
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream(
          "call-counts",
          ORDERS_LIST_COUNTS_TOOL_NAME,
          JSON.stringify({
            groupBy: "product",
            statuses: ["new", "confirmed"],
          }),
        ),
        mockTextStream("Active orders include 4000 milli of the widget."),
      ],
    });
    const app = chatApp(streamModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Eval 1 counts",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(
        conversation.id,
        "Which products are in active orders?",
      ),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    await waitFor(async () => {
      const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
      return runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list" &&
          run.outcome === "success",
      );
    }, "orders.list aggregate via orders_list_counts");
    const listRuns = (
      await kit.db.runtime.db.select().from(assistantToolRuns)
    ).filter(
      (run) =>
        run.conversationId === conversation.id &&
        run.actionName === "orders.list",
    );
    expect(listRuns).toHaveLength(1);
    expect(streamModel.doStreamCalls.length).toBe(2);
    const toolNames = (streamModel.doStreamCalls[0]?.tools ?? []).map(
      (tool) => tool.name,
    );
    expect(toolNames).toContain(ORDERS_LIST_COUNTS_TOOL_NAME);
    expect(toolNames).not.toContain(toProviderToolName("orders.list"));
    const secondStep = JSON.stringify(streamModel.doStreamCalls[1]);
    expect(secondStep).toContain("quantityMilli");
    expect(secondStep).toContain("4000");
  });

  it("eval 2: gross in a date range uses one orders_list_counts groupBy none", async () => {
    const createdFrom = "2026-08-30T21:00:00.000Z";
    const createdTo = "2026-09-06T20:59:59.999Z";
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream(
          "call-gross",
          ORDERS_LIST_COUNTS_TOOL_NAME,
          JSON.stringify({
            groupBy: "none",
            createdFrom,
            createdTo,
          }),
        ),
        mockTextStream("Here is this week's bounded gross rollup."),
      ],
    });
    const app = chatApp(streamModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Eval 2 counts",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "What is the order gross this week?"),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    await waitFor(async () => {
      const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
      return runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list" &&
          run.outcome === "success",
      );
    }, "orders.list aggregate groupBy none with date interval");
    const listRuns = (
      await kit.db.runtime.db.select().from(assistantToolRuns)
    ).filter(
      (run) =>
        run.conversationId === conversation.id &&
        run.actionName === "orders.list",
    );
    expect(listRuns).toHaveLength(1);
    expect(streamModel.doStreamCalls.length).toBe(2);
    const toolNames = (streamModel.doStreamCalls[0]?.tools ?? []).map(
      (tool) => tool.name,
    );
    expect(toolNames).toContain(ORDERS_LIST_COUNTS_TOOL_NAME);
    expect(toolNames).not.toContain(toProviderToolName("orders.list"));
    const secondStep = JSON.stringify(streamModel.doStreamCalls[1]);
    expect(secondStep).toContain('"kind":"aggregate"');
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
      customer: { by: "id", id: customer.id },
      items: [
        {
          product: { by: "id", id: product.productId },
          quantity: { milli: "1000" },
        },
      ],
    });
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream(
            "call-create",
            toProviderToolName("orders.create"),
            createInput,
          ),
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
            toProviderToolName("customers.deleteCustomer"),
            deleteInput,
          ),
          mockToolCallStream(
            "call-delete-resume",
            toProviderToolName("customers.deleteCustomer"),
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
    const confirmation = confirmationFromSsePayloads(pausePayloads);
    expect(confirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(confirmation)) {
      expect.unreachable("expected confirmation part");
    }
    expect(confirmation.summary).toContain("Delete this archived customer");
    expect(confirmation.toolCallId).toBe("call-delete");
    expect(JSON.stringify(pausePayloads)).not.toContain(
      "The customer was deleted.",
    );

    const stillThere = (
      await kit.db.runtime.db.select().from(companyCustomers)
    ).filter((row) => row.id === customer.id);
    expect(stillThere).toHaveLength(1);

    const resumeRequestId = randomUUID();
    const resumeBody = userChatBody(
      conversation.id,
      "Delete the archived customer",
    );
    expect(
      JSON.stringify(resumeBody.messages).includes("data-confirmation"),
    ).toBe(false);
    const resume = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: resumeBody,
      challengeId: confirmation.challengeId,
      extraHeaders: { [REQUEST_ID_HEADER]: resumeRequestId },
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

    const audit = await kit.db.runtime.db.select().from(auditLog);
    const resumeAudit = audit.find(
      (row) =>
        row.action === "customers.deleteCustomer" &&
        row.requestId === resumeRequestId &&
        row.outcome === "ok",
    );
    expect(resumeAudit).toMatchObject({
      channel: ASSISTANT_INVOCATION_CHANNEL,
      toolCallId: "call-delete-resume",
    });
    const keys = await kit.db.runtime.db.select().from(idempotencyKeys);
    const pausedKey = keys.find(
      (row) =>
        row.action === "customers.deleteCustomer" &&
        row.key === attemptKey("tool", conversation.id, "call-delete"),
    );
    expect(pausedKey?.status).toBe("completed");
  });

  it("does not bind a resume challenge to a different high-risk tool", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI Challenge Scope",
      phone: "+380671110003",
    });
    await staffInvoke(archiveCustomer, { id: customer.id });
    const group = await staffInvoke(createGroup, {
      name: "AI Challenge Group",
    });
    const deleteCustomerInput = JSON.stringify({ id: customer.id });
    const deleteGroupInput = JSON.stringify({ id: group.id });
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream(
            "call-delete",
            toProviderToolName("customers.deleteCustomer"),
            deleteCustomerInput,
          ),
          mockToolCallStream(
            "call-wrong",
            toProviderToolName("customers.deleteGroup"),
            deleteGroupInput,
          ),
          mockToolCallStream(
            "call-delete-resume",
            toProviderToolName("customers.deleteCustomer"),
            deleteCustomerInput,
          ),
          mockTextStream("The customer was deleted."),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Challenge scope",
    });
    const pause = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
    });
    expect(pause.status).toBe(200);
    const pausePayloads = await readUiMessageSsePayloads(pause);
    const confirmation = confirmationFromSsePayloads(pausePayloads);
    expect(confirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(confirmation)) {
      expect.unreachable("expected confirmation part");
    }
    expect(confirmation.actionName).toBe("customers.deleteCustomer");

    const mismatched = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
      challengeId: confirmation.challengeId,
    });
    expect(mismatched.status).toBe(200);
    const mismatchedPayloads = await readUiMessageSsePayloads(mismatched);
    const mismatchedConfirmation =
      confirmationFromSsePayloads(mismatchedPayloads);
    expect(mismatchedConfirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(mismatchedConfirmation)) {
      expect.unreachable("expected a new confirmation for the other tool");
    }
    expect(mismatchedConfirmation.actionName).toBe("customers.deleteGroup");
    expect(mismatchedConfirmation.challengeId).not.toBe(
      confirmation.challengeId,
    );

    const stillCustomer = (
      await kit.db.runtime.db.select().from(companyCustomers)
    ).filter((row) => row.id === customer.id);
    expect(stillCustomer).toHaveLength(1);
    const stillGroup = (
      await kit.db.runtime.db.select().from(customerGroups)
    ).filter((row) => row.id === group.id);
    expect(stillGroup).toHaveLength(1);

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
    }, "deleted customer after scoped resume");

    const groupAfter = (
      await kit.db.runtime.db.select().from(customerGroups)
    ).filter((row) => row.id === group.id);
    expect(groupAfter).toHaveLength(1);
  });
});

describe("POST /assistant/chat attempt identity", () => {
  it("inserts two user rows for the same text with different message ids, and replays the same id", async () => {
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockTextStream("ok"),
          mockTextStream("ok"),
          mockTextStream("ok"),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Так",
    });
    const firstId = randomUUID();
    const secondId = randomUUID();
    const first = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "так", firstId),
    });
    expect(first.status).toBe(200);
    await readUiMessageSsePayloads(first);
    expect(await userMessageCount(conversation.id)).toBe(1);

    const second = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "так", secondId),
    });
    expect(second.status).toBe(200);
    await readUiMessageSsePayloads(second);
    expect(await userMessageCount(conversation.id)).toBe(2);

    const replay = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "так", firstId),
    });
    expect(replay.status).toBe(200);
    await readUiMessageSsePayloads(replay);
    expect(await userMessageCount(conversation.id)).toBe(2);
  });

  it("conflicts when the same message id is retried with different text", async () => {
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [mockTextStream("ok")],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Conflict",
    });
    const messageId = randomUUID();
    const first = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "так", messageId),
    });
    expect(first.status).toBe(200);
    await readUiMessageSsePayloads(first);
    expect(await userMessageCount(conversation.id)).toBe(1);

    const conflict = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "ні", messageId),
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      status: 409,
    });
    expect(await userMessageCount(conversation.id)).toBe(1);
  });

  it("creates two orders for the same input with different tool ids, and replays the same tool id", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI Attempt Buyer",
      phone: "+380671110004",
    });
    const product = await staffInvoke(createProduct, {
      name: "AI Attempt Cake",
      basePriceMinor: "15000",
    });
    const createInput = JSON.stringify({
      customer: { by: "id", id: customer.id },
      items: [
        {
          product: { by: "id", id: product.productId },
          quantity: { milli: "1000" },
        },
      ],
    });
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream(
            "call-create-a",
            toProviderToolName("orders.create"),
            createInput,
          ),
          mockTextStream("Order A."),
          mockToolCallStream(
            "call-create-b",
            toProviderToolName("orders.create"),
            createInput,
          ),
          mockTextStream("Order B."),
          mockToolCallStream(
            "call-create-a",
            toProviderToolName("orders.create"),
            createInput,
          ),
          mockTextStream("Order A again."),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Two creates",
    });

    async function createViaChat(text: string): Promise<void> {
      const response = await postChat(app, {
        token,
        companyId: kitIdentities.companies.a,
        body: userChatBody(conversation.id, text),
      });
      expect(response.status).toBe(200);
      await readUiMessageSsePayloads(response);
    }

    await createViaChat("Create order A");
    await createViaChat("Create order B");
    await waitFor(async () => {
      const rows = await kit.db.runtime.db.select().from(orders);
      return (
        rows.filter(
          (row) =>
            row.companyId === kitIdentities.companies.a &&
            row.customerId === customer.id,
        ).length === 2
      );
    }, "two orders");

    await createViaChat("Create order A again");
    const afterReplay = (await kit.db.runtime.db.select().from(orders)).filter(
      (row) =>
        row.companyId === kitIdentities.companies.a &&
        row.customerId === customer.id,
    );
    expect(afterReplay).toHaveLength(2);

    const keys = await kit.db.runtime.db.select().from(idempotencyKeys);
    expect(
      keys.some(
        (row) =>
          row.action === "orders.create" &&
          row.key === attemptKey("tool", conversation.id, "call-create-a") &&
          row.status === "completed",
      ),
    ).toBe(true);
    expect(
      keys.some(
        (row) =>
          row.action === "orders.create" &&
          row.key === attemptKey("tool", conversation.id, "call-create-b") &&
          row.status === "completed",
      ),
    ).toBe(true);
  });

  it("uses only the first matching resume call as the paused attempt", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI One Shot",
      phone: "+380671110005",
    });
    await staffInvoke(archiveCustomer, { id: customer.id });
    const deleteInput = JSON.stringify({ id: customer.id });
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream(
            "call-delete",
            toProviderToolName("customers.deleteCustomer"),
            deleteInput,
          ),
          mockToolCallStream(
            "call-resume-b",
            toProviderToolName("customers.deleteCustomer"),
            deleteInput,
          ),
          mockToolCallStream(
            "call-resume-c",
            toProviderToolName("customers.deleteCustomer"),
            deleteInput,
          ),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "One-shot claim",
    });
    const pause = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
    });
    expect(pause.status).toBe(200);
    const confirmation = confirmationFromSsePayloads(
      await readUiMessageSsePayloads(pause),
    );
    expect(confirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(confirmation)) {
      expect.unreachable("expected confirmation part");
    }

    const resume = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
      challengeId: confirmation.challengeId,
    });
    expect(resume.status).toBe(200);
    const resumePayloads = await readUiMessageSsePayloads(resume);
    const secondConfirmation = confirmationFromSsePayloads(resumePayloads);
    expect(secondConfirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(secondConfirmation)) {
      expect.unreachable("expected a new confirmation for the second call");
    }
    expect(secondConfirmation.actionName).toBe("customers.deleteCustomer");
    expect(secondConfirmation.toolCallId).toBe("call-resume-c");
    expect(secondConfirmation.challengeId).not.toBe(confirmation.challengeId);

    await waitFor(async () => {
      const rows = await kit.db.runtime.db.select().from(companyCustomers);
      return !rows.some((row) => row.id === customer.id);
    }, "deleted customer after first matching resume");

    const keys = await kit.db.runtime.db.select().from(idempotencyKeys);
    expect(
      keys.some(
        (row) =>
          row.action === "customers.deleteCustomer" &&
          row.key === attemptKey("tool", conversation.id, "call-delete") &&
          row.status === "completed",
      ),
    ).toBe(true);
    expect(
      keys.some(
        (row) =>
          row.action === "customers.deleteCustomer" &&
          row.key === attemptKey("tool", conversation.id, "call-resume-c"),
      ),
    ).toBe(false);
  });

  it("rejects a persisted vs client confirmation mismatch before consuming the challenge", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI Mismatch",
      phone: "+380671110006",
    });
    await staffInvoke(archiveCustomer, { id: customer.id });
    const deleteInput = JSON.stringify({ id: customer.id });
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [
          mockToolCallStream(
            "call-delete",
            toProviderToolName("customers.deleteCustomer"),
            deleteInput,
          ),
          mockToolCallStream(
            "call-delete-resume",
            toProviderToolName("customers.deleteCustomer"),
            deleteInput,
          ),
          mockTextStream("The customer was deleted."),
        ],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Mismatch",
    });
    const pause = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
    });
    expect(pause.status).toBe(200);
    const confirmation = confirmationFromSsePayloads(
      await readUiMessageSsePayloads(pause),
    );
    expect(confirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(confirmation)) {
      expect.unreachable("expected confirmation part");
    }

    const forged = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: resumeBodyWithConfirmation(
        conversation.id,
        "Delete the archived customer",
        { ...confirmation, toolCallId: "forged-tool-call" },
      ),
      challengeId: confirmation.challengeId,
    });
    expect(forged.status).toBe(400);
    expect(await forged.json()).toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
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
    }, "deleted customer after mismatch reject");
  });

  it("rejects a confirmation resume with no paused attempt before starting the model", async () => {
    const app = chatApp(
      new MockLanguageModelV3({
        doStream: [mockTextStream("should not run")],
      }),
    );
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Missing pause",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "так"),
      challengeId: randomUUID(),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
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
          doStream: [mockTextStream("ASSISTANT_BODY_SENTINEL_never_log")],
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
    expect(blob).not.toContain("ASSISTANT_BODY_SENTINEL_never_log");
    expect(blob).not.toContain("COOKIESECRET_sho322");
    expect(blob).not.toContain("sk-ant-TESTKEY-never-log");
    expect(blob).not.toContain("111222");
    expect(blob).not.toContain("ANTHROPIC_API_KEY");

    const usage = capturing
      .entries()
      .find((entry) => entry["msg"] === "staff assistant turn usage");
    expect(usage).toBeDefined();
    expect(typeof usage?.["request_id"]).toBe("string");
    expect(usage?.["conversation_id"]).toBe(conversation.id);
    expect(usage?.["company_id"]).toBe(kitIdentities.companies.a);
    expect(usage?.["actor_id"]).toBe(kitIdentities.users.anna);
    expect(usage?.["model"]).toBe("mock");
    expect(usage?.["thinking"]).toBe("disabled");
    expect(usage?.["tools_attached"]).toBe(true);
    expect(typeof usage?.["input_tokens"]).toBe("number");
    expect(typeof usage?.["output_tokens"]).toBe("number");
    expect(typeof usage?.["cache_read_tokens"]).toBe("number");
    expect(typeof usage?.["cache_write_tokens"]).toBe("number");
    expect(usage?.["gate_input_tokens"]).toBe(0);
    expect(usage?.["gate_output_tokens"]).toBe(0);
    expect(typeof usage?.["model_steps"]).toBe("number");
    expect(usage?.["tool_count"]).toBe(0);
    expect(usage?.["tool_names"]).toEqual([]);
    expect(typeof usage?.["uncached_input_tokens"]).toBe("number");
    expect(typeof usage?.["cache_hit_ratio"]).toBe("number");
    expect(typeof usage?.["history_message_count"]).toBe("number");
    expect(typeof usage?.["history_chars"]).toBe("number");
    expect(typeof usage?.["tool_result_bytes_in"]).toBe("number");
    expect(typeof usage?.["tool_result_bytes_out"]).toBe("number");
    expect(typeof usage?.["toolset_hash"]).toBe("string");
    expect(typeof usage?.["estimated_cost_usd"]).toBe("number");
    expect(Number.isFinite(usage?.["estimated_cost_usd"])).toBe(true);
    expect(JSON.stringify(usage)).not.toContain(prompt);
    expect(JSON.stringify(usage)).not.toContain(
      "ASSISTANT_BODY_SENTINEL_never_log",
    );
    expect(usage).not.toHaveProperty("text");
    expect(usage).not.toHaveProperty("body");
    expect(usage).not.toHaveProperty("prompt");
    expect(usage).not.toHaveProperty("messages");
  });

  it("maps gate generateText usage onto the turn usage line", async () => {
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
        gateModel: "mock-gate",
        languageModel: new MockLanguageModelV3({
          doStream: [mockTextStream("You have no orders.")],
        }),
        gateLanguageModel: new MockLanguageModelV3({
          doGenerate: mockOperationalGateGenerate(true),
        }),
      },
    });
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Gate usage",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    const usage = capturing
      .entries()
      .find((entry) => entry["msg"] === "staff assistant turn usage");
    expect(usage?.["gate_model"]).toBe("mock-gate");
    expect(usage?.["gate_input_tokens"]).toBe(1);
    expect(usage?.["gate_output_tokens"]).toBe(1);
    expect(typeof usage?.["estimated_cost_usd"]).toBe("number");
    expect(JSON.stringify(usage)).not.toContain("List orders");
  });

  it("logs zero gate tokens when classify throws and still fail-opens", async () => {
    const capturing = createCapturingLogger();
    const streamModel = new MockLanguageModelV3({
      doStream: [mockTextStream("You have no orders.")],
    });
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
        gateModel: "mock-gate",
        languageModel: streamModel,
        gateLanguageModel: new MockLanguageModelV3({
          doGenerate: () => Promise.reject(new Error("gate down")),
        }),
      },
    });
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Gate throw",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    expect(streamModel.doStreamCalls.length).toBeGreaterThan(0);
    const usage = capturing
      .entries()
      .find((entry) => entry["msg"] === "staff assistant turn usage");
    expect(usage?.["gate_model"]).toBe("mock-gate");
    expect(usage?.["gate_input_tokens"]).toBe(0);
    expect(usage?.["gate_output_tokens"]).toBe(0);
    expect(usage?.["tools_attached"]).toBe(true);
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

describe("POST /assistant/chat operational gate", () => {
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function streamTools(model: MockLanguageModelV3) {
    return model.doStreamCalls.at(-1)?.tools ?? [];
  }

  function streamToolsLength(model: MockLanguageModelV3): number {
    return streamTools(model).length;
  }

  function streamToolNames(model: MockLanguageModelV3): string[] {
    return streamTools(model).map((tool) => tool.name);
  }

  function streamToolProviderOptions(tool: unknown): unknown {
    return isRecord(tool) ? tool["providerOptions"] : undefined;
  }

  it("does not attach tools or execute domain actions when the gate is false", async () => {
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream("call-list", ORDERS_LIST_PAGE_TOOL_NAME, "{}"),
        mockTextStream("should not run"),
      ],
    });
    const gateModel = new MockLanguageModelV3({
      doGenerate: mockOperationalGateGenerate(false),
      doStream: [mockTextStream("I only help with this company.")],
    });
    const app = chatApp(streamModel, gateModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Weather",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "What's the weather in Kyiv?"),
    });
    expect(response.status).toBe(200);
    const payloads = await readUiMessageSsePayloads(response);
    expect(JSON.stringify(payloads)).toContain(
      "I only help with this company.",
    );
    expect(JSON.stringify(payloads)).not.toContain("should not run");
    expect(streamModel.doStreamCalls).toHaveLength(0);
    expect(streamToolsLength(gateModel)).toBe(0);
    expect(gateModel.doGenerateCalls).toHaveLength(1);
    const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
    expect(
      runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list",
      ),
    ).toBe(false);
  });

  it("attaches tools when the gate is true", async () => {
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream("call-list", ORDERS_LIST_PAGE_TOOL_NAME, "{}"),
        mockTextStream("You have no orders."),
      ],
    });
    const gateModel = new MockLanguageModelV3({
      doGenerate: mockOperationalGateGenerate(true),
      doStream: [mockTextStream("should not reply as gate")],
    });
    const app = chatApp(streamModel, gateModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "List gated",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    await waitFor(async () => {
      const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
      return runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list" &&
          run.outcome === "success",
      );
    }, "orders.list through operational gate");
    expect(streamToolsLength(streamModel)).toBeGreaterThan(0);
    expect(gateModel.doStreamCalls).toHaveLength(0);
    const names = streamToolNames(streamModel);
    expect(names).toContain(STAFF_ASSISTANT_TOOL_SEARCH_NAME);
    expect(names).toContain(ORDERS_LIST_PAGE_TOOL_NAME);
    expect(names).toContain(ORDERS_LIST_COUNTS_TOOL_NAME);
    expect(names).not.toContain(toProviderToolName("orders.list"));
    const deferred = streamTools(streamModel).find(
      (tool) => tool.name === toProviderToolName("customers.deleteCustomer"),
    );
    expect(deferred).toBeDefined();
    expect(streamToolProviderOptions(deferred)).toMatchObject({
      anthropic: { deferLoading: true },
    });
  });

  it("fail-opens and attaches tools when classify throws", async () => {
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream("call-list", ORDERS_LIST_PAGE_TOOL_NAME, "{}"),
        mockTextStream("You have no orders."),
      ],
    });
    const gateModel = new MockLanguageModelV3({
      doGenerate: () => Promise.reject(new Error("gate down")),
      doStream: [mockTextStream("should not reply as gate")],
    });
    const app = chatApp(streamModel, gateModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Fail open",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(response.status).toBe(200);
    await readUiMessageSsePayloads(response);
    await waitFor(async () => {
      const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
      return runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list",
      );
    }, "fail-open still lists orders");
    expect(streamToolsLength(streamModel)).toBeGreaterThan(0);
  });

  it("skips the gate on confirmation resume and still attaches tools", async () => {
    const customer = await staffInvoke(createCustomer, {
      name: "AI Gate Resume",
      phone: "+380671110009",
    });
    await staffInvoke(archiveCustomer, { id: customer.id });
    const deleteInput = JSON.stringify({ id: customer.id });
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream(
          "call-delete",
          toProviderToolName("customers.deleteCustomer"),
          deleteInput,
        ),
        mockToolCallStream(
          "call-delete-resume",
          toProviderToolName("customers.deleteCustomer"),
          deleteInput,
        ),
        mockTextStream("The customer was deleted."),
      ],
    });
    const gateModel = new MockLanguageModelV3({
      doGenerate: mockOperationalGateGenerate(true),
      doStream: [mockTextStream("should not chitchat")],
    });
    const app = chatApp(streamModel, gateModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Gate resume",
    });
    const pause = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Delete the archived customer"),
    });
    expect(pause.status).toBe(200);
    const confirmation = confirmationFromSsePayloads(
      await readUiMessageSsePayloads(pause),
    );
    expect(confirmation).toBeDefined();
    if (!isStaffAssistantConfirmationOutput(confirmation)) {
      expect.unreachable("expected confirmation part");
    }
    expect(gateModel.doGenerateCalls).toHaveLength(1);

    const resume = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "так"),
      challengeId: confirmation.challengeId,
    });
    expect(resume.status).toBe(200);
    await readUiMessageSsePayloads(resume);
    expect(gateModel.doGenerateCalls).toHaveLength(1);
    expect(streamToolsLength(streamModel)).toBeGreaterThan(0);
    const resumeNames = streamToolNames(streamModel);
    expect(resumeNames).toContain(STAFF_ASSISTANT_TOOL_SEARCH_NAME);
    expect(resumeNames).toContain(
      toProviderToolName("customers.deleteCustomer"),
    );
  });

  it("skips the gate on any follow-up after a tool-using turn", async () => {
    const capturing = createCapturingLogger();
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream("call-list", ORDERS_LIST_PAGE_TOOL_NAME, "{}"),
        mockTextStream("You have no orders."),
        mockTextStream("Creating the price list."),
      ],
    });
    let gateCalls = 0;
    const gateModel = new MockLanguageModelV3({
      doGenerate: () => {
        gateCalls += 1;
        return Promise.resolve(mockOperationalGateGenerate(gateCalls === 1));
      },
      doStream: [mockTextStream("should not reply as gate")],
    });
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
        gateModel: "mock-gate",
        languageModel: streamModel,
        gateLanguageModel: gateModel,
      },
    });
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Sticky session",
    });
    const first = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(first.status).toBe(200);
    await readUiMessageSsePayloads(first);
    await waitFor(async () => {
      const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
      return runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list" &&
          run.outcome === "success",
      );
    }, "orders.list before sticky follow-up");
    expect(gateModel.doGenerateCalls).toHaveLength(1);

    const followUp = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "Продовжуй"),
    });
    expect(followUp.status).toBe(200);
    const payloads = await readUiMessageSsePayloads(followUp);
    expect(JSON.stringify(payloads)).toContain("Creating the price list.");
    expect(gateModel.doGenerateCalls).toHaveLength(1);
    expect(gateModel.doStreamCalls).toHaveLength(0);
    expect(streamToolsLength(streamModel)).toBeGreaterThan(0);
    expect(streamToolNames(streamModel)).toContain(
      STAFF_ASSISTANT_TOOL_SEARCH_NAME,
    );
    const skipGate = capturing
      .entries()
      .find(
        (entry) =>
          entry["msg"] === "staff assistant turn gate" &&
          entry["gate_skip"] === "sticky_session",
      );
    expect(skipGate?.["operational"]).toBe(true);
    const followUpUsage = capturing
      .entries()
      .filter((entry) => entry["msg"] === "staff assistant turn usage")
      .at(-1);
    expect(followUpUsage?.["gate_skip"]).toBe("sticky_session");
    expect(followUpUsage?.["tools_attached"]).toBe(true);
    expect(JSON.stringify(followUpUsage)).not.toContain("Продовжуй");
  });

  it("keeps tools attached for weather after a tool-using turn", async () => {
    const streamModel = new MockLanguageModelV3({
      doStream: [
        mockToolCallStream("call-list", ORDERS_LIST_PAGE_TOOL_NAME, "{}"),
        mockTextStream("You have no orders."),
        mockTextStream("I only help with this company."),
      ],
    });
    let gateCalls = 0;
    const gateModel = new MockLanguageModelV3({
      doGenerate: () => {
        gateCalls += 1;
        return Promise.resolve(mockOperationalGateGenerate(gateCalls === 1));
      },
      doStream: [mockTextStream("should not reply as gate")],
    });
    const app = chatApp(streamModel, gateModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Weather after tools",
    });
    const first = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "List orders"),
    });
    expect(first.status).toBe(200);
    await readUiMessageSsePayloads(first);
    await waitFor(async () => {
      const runs = await kit.db.runtime.db.select().from(assistantToolRuns);
      return runs.some(
        (run) =>
          run.conversationId === conversation.id &&
          run.actionName === "orders.list" &&
          run.outcome === "success",
      );
    }, "orders.list before weather");

    const weather = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "What's the weather in Kyiv?"),
    });
    expect(weather.status).toBe(200);
    const payloads = await readUiMessageSsePayloads(weather);
    expect(JSON.stringify(payloads)).toContain(
      "I only help with this company.",
    );
    expect(gateModel.doGenerateCalls).toHaveLength(1);
    expect(gateModel.doStreamCalls).toHaveLength(0);
    expect(streamModel.doStreamCalls).toHaveLength(3);
    expect(streamToolsLength(streamModel)).toBeGreaterThan(0);
  });

  it("still classifies a short ack when the conversation has no tool runs", async () => {
    const streamModel = new MockLanguageModelV3({
      doStream: [mockTextStream("should not run")],
    });
    const gateModel = new MockLanguageModelV3({
      doGenerate: mockOperationalGateGenerate(false),
      doStream: [mockTextStream("I only help with this company.")],
    });
    const app = chatApp(streamModel, gateModel);
    const token = await insertBearer(kit, kitIdentities.users.anna);
    const conversation = await staffInvoke(createConversation, {
      title: "Ack without tools",
    });
    const response = await postChat(app, {
      token,
      companyId: kitIdentities.companies.a,
      body: userChatBody(conversation.id, "так"),
    });
    expect(response.status).toBe(200);
    const payloads = await readUiMessageSsePayloads(response);
    expect(JSON.stringify(payloads)).toContain(
      "I only help with this company.",
    );
    expect(streamModel.doStreamCalls).toHaveLength(0);
    expect(gateModel.doGenerateCalls).toHaveLength(1);
    expect(streamToolsLength(gateModel)).toBe(0);
  });
});
