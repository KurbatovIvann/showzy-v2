import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { assistantCopy } from "../../../i18n/assistant";
import { ordersCopy } from "../../../i18n/orders";
import { orderDetailHref } from "../../orders/shared/order-hrefs";
import {
  associateToolRunsWithAssistantMessages,
  entityResultIdsFromToolRuns,
  findOwnConversationId,
  firstOwnConversationId,
  hydratedUiMessagesFromConversation,
  isHydratableOrderEntityRun,
  isUnrestorableListRun,
  loadOrdersById,
  type AssistantConversationListItem,
  type AssistantHistoryMessage,
  type AssistantHistoryToolRun,
  type AssistantListConversationsInput,
} from "./assistant-hydrate";
import { assistantChatRows } from "./chat-rows";
import { assistantResultCardsFromParts } from "./result-cards";

const SESSION_USER = "user-own";
const COLLEAGUE_USER = "user-colleague";
const CONV_OWN = "11111111-1111-4111-8111-111111111111";
const CONV_COLLEAGUE = "22222222-2222-4222-8222-222222222222";
const CONV_OWN_OLDER = "33333333-3333-4333-8333-333333333333";
const ORDER_A = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const ORDER_B = "1a2b3c4d-5e6f-4789-8abc-def012345678";
const NESTED_ORDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MSG_USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MSG_ASSISTANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MSG_ASSISTANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RUN_LIST = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RUN_GET = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const RUN_CREATE = "99999999-9999-4999-8999-999999999999";
const uk = assistantCopy("uk");
const ordersUk = ordersCopy("uk");

function listItem(
  id: string,
  userId: string,
): AssistantConversationListItem {
  return { id, userId };
}

function message(args: {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly body: string;
  readonly createdAt: string;
}): AssistantHistoryMessage {
  return args;
}

function toolRun(args: {
  readonly id: string;
  readonly actionName: string;
  readonly toolCallId: string;
  readonly resultIds?: readonly string[];
  readonly outcome?: AssistantHistoryToolRun["outcome"];
  readonly createdAt: string;
}): AssistantHistoryToolRun {
  return {
    id: args.id,
    actionName: args.actionName,
    toolCallId: args.toolCallId,
    resultIds: args.resultIds ?? [],
    outcome: args.outcome ?? "success",
    createdAt: args.createdAt,
  };
}

function orderSnapshot(
  orderId: string,
  status: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    orderId,
    orderNumber: "1049",
    status,
    totalGrossMinor: "33000",
    currency: "UAH",
    createdAt: "2026-09-03T10:00:00.000Z",
    ...extra,
  };
}

describe("firstOwnConversationId", () => {
  it("picks the first own-user row and skips a newer colleague thread", () => {
    expect(
      firstOwnConversationId(
        [
          listItem(CONV_COLLEAGUE, COLLEAGUE_USER),
          listItem(CONV_OWN, SESSION_USER),
        ],
        SESSION_USER,
      ),
    ).toBe(CONV_OWN);
  });

  it("returns null when the first page is only a colleague", () => {
    expect(
      firstOwnConversationId(
        [listItem(CONV_COLLEAGUE, COLLEAGUE_USER)],
        SESSION_USER,
      ),
    ).toBeNull();
  });
});

describe("findOwnConversationId", () => {
  it("does not send userId or companyId on listConversations input", async () => {
    const inputs: AssistantListConversationsInput[] = [];
    const ownId = await findOwnConversationId({
      sessionUserId: SESSION_USER,
      listConversations: (input) => {
        inputs.push(input);
        return Promise.resolve({
          items: [listItem(CONV_OWN, SESSION_USER)],
          nextCursor: null,
        });
      },
    });
    expect(ownId).toBe(CONV_OWN);
    expect(inputs).toEqual([{}]);
    expect(JSON.stringify(inputs[0])).not.toContain("userId");
    expect(JSON.stringify(inputs[0])).not.toContain("companyId");
  });

  it("follows nextCursor only until an own-user row", async () => {
    const inputs: AssistantListConversationsInput[] = [];
    const ownId = await findOwnConversationId({
      sessionUserId: SESSION_USER,
      listConversations: (input) => {
        inputs.push(input);
        if (input.cursor === undefined) {
          return Promise.resolve({
            items: [listItem(CONV_COLLEAGUE, COLLEAGUE_USER)],
            nextCursor: "cursor-2",
          });
        }
        return Promise.resolve({
          items: [listItem(CONV_OWN_OLDER, SESSION_USER)],
          nextCursor: null,
        });
      },
    });
    expect(ownId).toBe(CONV_OWN_OLDER);
    expect(inputs).toEqual([{}, { cursor: "cursor-2" }]);
    expect(JSON.stringify(inputs)).not.toContain("userId");
    expect(JSON.stringify(inputs)).not.toContain("companyId");
  });

  it("does not hydrate a colleague when no own row exists", async () => {
    const ownId = await findOwnConversationId({
      sessionUserId: SESSION_USER,
      listConversations: () =>
        Promise.resolve({
          items: [listItem(CONV_COLLEAGUE, COLLEAGUE_USER)],
          nextCursor: null,
        }),
    });
    expect(ownId).toBeNull();
  });
});

describe("entityResultIdsFromToolRuns", () => {
  it("collects top-level resultIds from orders.get / orders.create only", () => {
    const runs = [
      toolRun({
        id: RUN_LIST,
        actionName: "orders.list",
        toolCallId: "call-list",
        resultIds: [NESTED_ORDER],
        createdAt: "2026-09-03T10:00:00.000Z",
      }),
      toolRun({
        id: RUN_GET,
        actionName: "orders.get",
        toolCallId: "call-get",
        resultIds: [ORDER_A],
        createdAt: "2026-09-03T10:00:01.000Z",
      }),
      toolRun({
        id: RUN_CREATE,
        actionName: "orders.create",
        toolCallId: "call-create",
        resultIds: [ORDER_B],
        createdAt: "2026-09-03T10:00:02.000Z",
      }),
    ];
    expect(entityResultIdsFromToolRuns(runs)).toEqual([ORDER_A, ORDER_B]);
    expect(isUnrestorableListRun(runs[0]!)).toBe(true);
    expect(isHydratableOrderEntityRun(runs[0]!)).toBe(false);
    expect(isHydratableOrderEntityRun(runs[1]!)).toBe(true);
  });

  it("does not walk nested items[].orderId because those are not resultIds", () => {
    const source = readFileSync(
      new URL("./assistant-hydrate.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("items[].orderId");
    expect(source).not.toContain('["orderId"]');
    expect(source.includes("resultIds")).toBe(true);
    expect(
      entityResultIdsFromToolRuns([
        toolRun({
          id: RUN_LIST,
          actionName: "orders.list",
          toolCallId: "call-list",
          resultIds: [],
          createdAt: "2026-09-03T10:00:00.000Z",
        }),
      ]),
    ).toEqual([]);
  });
});

describe("hydratedUiMessagesFromConversation", () => {
  it("keeps list/aggregate prose and does not restore a list card", () => {
    const messages = hydratedUiMessagesFromConversation({
      messages: [
        message({
          id: MSG_USER,
          role: "user",
          body: "Замовлення в роботі",
          createdAt: "2026-09-03T10:00:00.000Z",
        }),
        message({
          id: MSG_ASSISTANT,
          role: "assistant",
          body: "Ось активні замовлення.",
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      toolRuns: [
        toolRun({
          id: RUN_LIST,
          actionName: "orders.list",
          toolCallId: "call-list",
          resultIds: [],
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      ordersById: new Map(),
    });
    expect(messages[1]?.parts).toEqual([
      { type: "text", text: "Ось активні замовлення." },
    ]);
    const cards = assistantResultCardsFromParts(
      messages[1]?.parts ?? [],
      "uk",
    );
    expect(cards.listCard).toBeNull();
    expect(cards.aggregateCard).toBeNull();
    expect(cards.entityCards).toEqual([]);
    const rows = assistantChatRows(messages, null, uk);
    expect(rows[1]?.text).toBe("Ось активні замовлення.");
    expect(rows[1]?.listCard).toBeNull();
    expect(rows[1]?.aggregateCard).toBeNull();
    expect(JSON.stringify(rows[1])).not.toContain("orders_list_page");
    expect(JSON.stringify(rows[1])).not.toContain("orders_list_counts");
    expect(rows[1]?.text.includes("{")).toBe(false);
  });

  it("hydrates thin entity cards via live orders.get snapshots", () => {
    const getOutput = orderSnapshot(ORDER_A, "in_progress");
    const createOutput = orderSnapshot(ORDER_B, "new", {
      customer: { nameSnapshot: "Оля", linkedCustomerId: null },
    });
    const messages = hydratedUiMessagesFromConversation({
      messages: [
        message({
          id: MSG_USER,
          role: "user",
          body: "Покажи замовлення",
          createdAt: "2026-09-03T10:00:00.000Z",
        }),
        message({
          id: MSG_ASSISTANT,
          role: "assistant",
          body: "Ось картка.",
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      toolRuns: [
        toolRun({
          id: RUN_GET,
          actionName: "orders.get",
          toolCallId: "call-get",
          resultIds: [ORDER_A],
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
        toolRun({
          id: RUN_CREATE,
          actionName: "orders.create",
          toolCallId: "call-create",
          resultIds: [ORDER_B],
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      ordersById: new Map([
        [ORDER_A, getOutput],
        [ORDER_B, createOutput],
      ]),
    });
    const cards = assistantResultCardsFromParts(
      messages[1]?.parts ?? [],
      "uk",
    );
    expect(cards.listCard).toBeNull();
    expect(cards.entityCards).toHaveLength(2);
    expect(cards.entityCards[0]?.orderId).toBe(ORDER_A);
    expect(cards.entityCards[0]?.href).toBe(orderDetailHref(ORDER_A));
    expect(cards.entityCards[0]?.statusLabel).toBe(
      ordersUk.statuses.in_progress,
    );
    expect(cards.entityCards[0]?.statusTone).toBe("attention");
    expect(cards.entityCards[1]?.customerName).toBe("Оля");
    expect(cards.entityCards[1]?.statusLabel).toBe(ordersUk.statuses.new);
    expect(cards.entityCards[1]?.statusTone).toBe("action");
    const rows = assistantChatRows(messages, null, uk);
    expect(rows[1]?.text).toBe("Ось картка.");
    expect(rows[1]?.entityCards).toHaveLength(2);
    expect(JSON.stringify(rows[1]?.text)).not.toContain("in_progress");
  });

  it("omits a missing or denied orders.get card and does not write status into the body", () => {
    const body = "Замовлення готове.";
    const messages = hydratedUiMessagesFromConversation({
      messages: [
        message({
          id: MSG_ASSISTANT,
          role: "assistant",
          body,
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      toolRuns: [
        toolRun({
          id: RUN_GET,
          actionName: "orders.get",
          toolCallId: "call-get",
          resultIds: [ORDER_A],
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      ordersById: new Map(),
    });
    expect(messages[0]?.parts).toEqual([{ type: "text", text: body }]);
    const cards = assistantResultCardsFromParts(
      messages[0]?.parts ?? [],
      "uk",
    );
    expect(cards.entityCards).toEqual([]);
    expect(messages[0]?.parts[0]).toEqual({ type: "text", text: body });
    expect(JSON.stringify(messages)).not.toContain("NOT_FOUND");
    expect(JSON.stringify(messages)).not.toContain("PERMISSION_DENIED");
    expect(JSON.stringify(messages)).not.toContain("canceled");
  });

  it("does not turn an orders.list run into N orders.get cards", () => {
    const messages = hydratedUiMessagesFromConversation({
      messages: [
        message({
          id: MSG_ASSISTANT,
          role: "assistant",
          body: "Знайшла кілька замовлень.",
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      toolRuns: [
        toolRun({
          id: RUN_LIST,
          actionName: "orders.list",
          toolCallId: "call-list",
          resultIds: [ORDER_A, ORDER_B],
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
      ],
      ordersById: new Map([
        [ORDER_A, orderSnapshot(ORDER_A, "new")],
        [ORDER_B, orderSnapshot(ORDER_B, "confirmed")],
      ]),
    });
    const cards = assistantResultCardsFromParts(
      messages[0]?.parts ?? [],
      "uk",
    );
    expect(cards.entityCards).toEqual([]);
    expect(cards.listCard).toBeNull();
  });

  it("pairs entity runs with the assistant message from that turn", () => {
    const grouped = associateToolRunsWithAssistantMessages(
      [
        message({
          id: MSG_ASSISTANT,
          role: "assistant",
          body: "Список.",
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
        message({
          id: MSG_ASSISTANT_B,
          role: "assistant",
          body: "Картка.",
          createdAt: "2026-09-03T10:00:05.000Z",
        }),
      ],
      [
        toolRun({
          id: RUN_LIST,
          actionName: "orders.list",
          toolCallId: "call-list",
          createdAt: "2026-09-03T10:00:01.000Z",
        }),
        toolRun({
          id: RUN_GET,
          actionName: "orders.get",
          toolCallId: "call-get",
          resultIds: [ORDER_A],
          createdAt: "2026-09-03T10:00:05.000Z",
        }),
      ],
    );
    expect(grouped.get(MSG_ASSISTANT)?.map((run) => run.id)).toEqual([RUN_LIST]);
    expect(grouped.get(MSG_ASSISTANT_B)?.map((run) => run.id)).toEqual([
      RUN_GET,
    ]);
  });
});

describe("loadOrdersById", () => {
  it("omits failed live gets without throwing", async () => {
    const getOrder = vi.fn((orderId: string) => {
      if (orderId === ORDER_A) {
        return Promise.resolve(orderSnapshot(ORDER_A, "done"));
      }
      return Promise.reject(new Error("PERMISSION_DENIED"));
    });
    const orders = await loadOrdersById({
      orderIds: [ORDER_A, ORDER_B],
      getOrder,
    });
    expect(orders.get(ORDER_A)).toEqual(orderSnapshot(ORDER_A, "done"));
    expect(orders.has(ORDER_B)).toBe(false);
    expect(getOrder).toHaveBeenCalledWith(ORDER_A);
    expect(getOrder).toHaveBeenCalledWith(ORDER_B);
  });
});

describe("assistant hydrate source", () => {
  it("does not look for façade names or walk nested list rows", () => {
    const source = readFileSync(
      new URL("./assistant-hydrate.ts", import.meta.url),
      "utf8",
    );
    const session = readFileSync(
      new URL("./assistant-session.ts", import.meta.url),
      "utf8",
    );
    const hook = readFileSync(
      new URL("../sheet/use-assistant-chat.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("orders_list_page");
    expect(source).not.toContain("orders_list_counts");
    expect(source).not.toContain("extractUuidResultIds");
    expect(source).not.toContain('"active"');
    expect(source).not.toContain("Підтвердити");
    expect(source).not.toContain("sit.svg");
    expect(source).not.toContain("dig.svg");
    expect(session).toContain("resumeOwnAssistantConversation");
    expect(session).not.toContain("orders_list_page");
    expect(hook).toContain("resumeOwnAssistantConversation");
    expect(hook).toContain("auth.session?.userId");
    expect(hook).not.toContain("ensureAssistantConversation");
    expect(hook).not.toContain("userId:");
    expect(hook).not.toContain("companyId:");
  });
});
