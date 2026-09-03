/**
 * Option C resume (SHO-371 / SHO-367): pick the signed-in staff user's
 * newest-updated conversation from a company-wide list, then rebuild
 * history from `getConversation`. List/counts runs stay prose-only.
 * Entity cards hydrate via live `orders.get` on top-level `resultIds`.
 *
 * `userId` is compared to the session here — never sent as list/get
 * input. Company id is never action input.
 */

export const ASSISTANT_LIST_CONVERSATIONS_PAGE_MAX = 50;

export const HYDRATABLE_ORDER_ENTITY_ACTIONS = new Set([
  "orders.get",
  "orders.create",
]);

export const UNRESTORABLE_LIST_ACTION = "orders.list";

export type AssistantConversationListItem = {
  readonly id: string;
  readonly userId: string;
};

export type AssistantListConversationsInput = {
  readonly cursor?: string;
};

export type AssistantListConversationsPage = {
  readonly items: readonly AssistantConversationListItem[];
  readonly nextCursor: string | null;
};

export type AssistantHistoryMessage = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly body: string;
  readonly createdAt: string;
};

export type AssistantHistoryToolRun = {
  readonly id: string;
  readonly actionName: string;
  readonly toolCallId: string;
  readonly resultIds: readonly string[];
  readonly outcome: "success" | "error" | "confirmation_required";
  readonly createdAt: string;
};

export type AssistantConversationDetail = {
  readonly id: string;
  readonly userId: string;
  readonly messages: readonly AssistantHistoryMessage[];
  readonly toolRuns: readonly AssistantHistoryToolRun[];
};

export type HydratedAssistantToolPart = {
  readonly type: "dynamic-tool";
  readonly toolName: "orders.get" | "orders.create";
  readonly toolCallId: string;
  readonly state: "output-available";
  readonly input: Record<string, never>;
  readonly output: unknown;
};

export type HydratedAssistantUiPart =
  { readonly type: "text"; readonly text: string } | HydratedAssistantToolPart;

export type HydratedAssistantUiMessage = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly parts: readonly HydratedAssistantUiPart[];
};

export type AssistantResumeResult =
  | { readonly kind: "empty" }
  | { readonly kind: "dropped" }
  | {
      readonly kind: "unavailable";
      readonly conversationId: string;
    }
  | {
      readonly kind: "resumed";
      readonly conversationId: string;
      readonly messages: readonly HydratedAssistantUiMessage[];
    };

export function firstOwnConversationId(
  items: readonly AssistantConversationListItem[],
  sessionUserId: string,
): string | null {
  for (const item of items) {
    if (item.userId === sessionUserId) {
      return item.id;
    }
  }
  return null;
}

export async function findOwnConversationId(args: {
  readonly sessionUserId: string;
  readonly listConversations: (
    input: AssistantListConversationsInput,
  ) => Promise<AssistantListConversationsPage>;
}): Promise<string | null> {
  let cursor: string | undefined;
  for (let page = 0; page < ASSISTANT_LIST_CONVERSATIONS_PAGE_MAX; page += 1) {
    const input: AssistantListConversationsInput =
      cursor === undefined ? {} : { cursor };
    const listed = await args.listConversations(input);
    const ownId = firstOwnConversationId(listed.items, args.sessionUserId);
    if (ownId !== null) {
      return ownId;
    }
    if (listed.nextCursor === null || listed.nextCursor === cursor) {
      return null;
    }
    cursor = listed.nextCursor;
  }
  return null;
}

export function isHydratableOrderEntityRun(
  run: AssistantHistoryToolRun,
): boolean {
  return (
    HYDRATABLE_ORDER_ENTITY_ACTIONS.has(run.actionName) &&
    run.outcome === "success" &&
    run.resultIds.length > 0
  );
}

export function isUnrestorableListRun(run: AssistantHistoryToolRun): boolean {
  return run.actionName === UNRESTORABLE_LIST_ACTION;
}

export function entityResultIdsFromToolRuns(
  toolRuns: readonly AssistantHistoryToolRun[],
): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const run of toolRuns) {
    if (!isHydratableOrderEntityRun(run)) {
      continue;
    }
    for (const resultId of run.resultIds) {
      if (seen.has(resultId)) {
        continue;
      }
      seen.add(resultId);
      ids.push(resultId);
    }
  }
  return ids;
}

function compareCreatedAtThenId(
  left: { readonly createdAt: string; readonly id: string },
  right: { readonly createdAt: string; readonly id: string },
): number {
  if (left.createdAt < right.createdAt) {
    return -1;
  }
  if (left.createdAt > right.createdAt) {
    return 1;
  }
  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
}

function sortedByCreatedAtThenId<
  T extends { readonly createdAt: string; readonly id: string },
>(items: readonly T[]): T[] {
  return items.slice().sort(compareCreatedAtThenId);
}

/**
 * Pair tool runs with the latest assistant message that already exists at
 * the run's timestamp. Same-transaction inserts share `createdAt` (no
 * messageId column — do not invent one). Advance while
 * `next.createdAt <= run.createdAt`. Do not compare message UUID to
 * tool-run UUID.
 */
export function associateToolRunsWithAssistantMessages(
  messages: readonly AssistantHistoryMessage[],
  toolRuns: readonly AssistantHistoryToolRun[],
): ReadonlyMap<string, readonly AssistantHistoryToolRun[]> {
  const assistantMessages = sortedByCreatedAtThenId(
    messages.filter((message) => message.role === "assistant"),
  );
  const orderedRuns = sortedByCreatedAtThenId(toolRuns);
  const grouped = new Map<string, AssistantHistoryToolRun[]>();
  for (const message of assistantMessages) {
    grouped.set(message.id, []);
  }
  if (assistantMessages.length === 0) {
    return grouped;
  }
  let assistantIndex = 0;
  for (const run of orderedRuns) {
    while (assistantIndex + 1 < assistantMessages.length) {
      const next = assistantMessages[assistantIndex + 1];
      if (next === undefined) {
        break;
      }
      if (next.createdAt > run.createdAt) {
        break;
      }
      assistantIndex += 1;
    }
    const current = assistantMessages[assistantIndex];
    if (current === undefined) {
      continue;
    }
    const bucket = grouped.get(current.id);
    if (bucket !== undefined) {
      bucket.push(run);
    }
  }
  return grouped;
}

function entityToolName(
  actionName: string,
): HydratedAssistantToolPart["toolName"] {
  return actionName === "orders.create" ? "orders.create" : "orders.get";
}

export function hydratedUiMessagesFromConversation(args: {
  readonly messages: readonly AssistantHistoryMessage[];
  readonly toolRuns: readonly AssistantHistoryToolRun[];
  readonly ordersById: ReadonlyMap<string, unknown>;
}): readonly HydratedAssistantUiMessage[] {
  const messages = sortedByCreatedAtThenId(args.messages);
  const toolRuns = sortedByCreatedAtThenId(args.toolRuns);
  const runsByMessage = associateToolRunsWithAssistantMessages(
    messages,
    toolRuns,
  );
  return messages.map((message) => {
    const parts: HydratedAssistantUiPart[] = [
      { type: "text", text: message.body },
    ];
    if (message.role === "assistant") {
      const runs = runsByMessage.get(message.id) ?? [];
      for (const run of runs) {
        if (isUnrestorableListRun(run) || !isHydratableOrderEntityRun(run)) {
          continue;
        }
        for (const resultId of run.resultIds) {
          const order = args.ordersById.get(resultId);
          if (order === undefined) {
            continue;
          }
          parts.push({
            type: "dynamic-tool",
            toolName: entityToolName(run.actionName),
            toolCallId:
              run.resultIds.length === 1
                ? run.toolCallId
                : `${run.toolCallId}:${resultId}`,
            state: "output-available",
            input: {},
            output: order,
          });
        }
      }
    }
    return {
      id: message.id,
      role: message.role,
      parts,
    };
  });
}

export async function loadOrdersById(args: {
  readonly orderIds: readonly string[];
  readonly getOrder: (orderId: string) => Promise<unknown>;
}): Promise<ReadonlyMap<string, unknown>> {
  const ordersById = new Map<string, unknown>();
  const snapshots = await Promise.all(
    args.orderIds.map(async (orderId) => {
      try {
        const order = await args.getOrder(orderId);
        return { orderId, order };
      } catch {
        return { orderId, order: null };
      }
    }),
  );
  for (const snapshot of snapshots) {
    if (snapshot.order !== null && snapshot.order !== undefined) {
      ordersById.set(snapshot.orderId, snapshot.order);
    }
  }
  return ordersById;
}
