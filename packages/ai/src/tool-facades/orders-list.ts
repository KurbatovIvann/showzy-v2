/**
 * Named staff-assistant tools over `orders.list` (SHO-355 / ADR-0033).
 *
 * Presentation adapter only: both tools `execute("orders.list", canonical)`.
 * Do not add `orders.listForAssistant`. Do not flatten `list.contract.ts`.
 */
import type { ActionContract } from "@showzy/core/contract";
import { tool, type Tool } from "ai";
import { z } from "zod";

import type { ActionToolExecute } from "../action-tool.js";

export const ORDERS_LIST_ACTION_NAME = "orders.list";
export const ORDERS_LIST_PAGE_TOOL_NAME = "orders_list_page";
export const ORDERS_LIST_COUNTS_TOOL_NAME = "orders_list_counts";

const orderStatusSchema = z.enum(["new", "confirmed", "canceled"]);

const statusesField = z.array(orderStatusSchema).min(1).max(3).optional();
const queryField = z.string().trim().min(1).max(100).optional();
const cursorField = z.string().min(1).max(80).optional();

export const ordersListPageInputSchema = z.strictObject({
  statuses: statusesField,
  query: queryField,
  cursor: cursorField,
});

export const ordersListCountsInputSchema = z.strictObject({
  statuses: statusesField,
  groupBy: z.enum(["none", "status", "product", "customer"]).default("status"),
});

export type OrdersListPageFacadeInput = z.output<
  typeof ordersListPageInputSchema
>;
export type OrdersListCountsFacadeInput = z.output<
  typeof ordersListCountsInputSchema
>;

const ORDERS_LIST_PAGE_DESCRIPTION =
  "Newest-first order headers in the active company. Optional statuses (new, confirmed, canceled; max 3). Omit statuses to include every CHECK status. There is no server status named active or all — until fulfillment statuses exist, active means new plus confirmed. Optional query matches the text order number (optional leading #) or CRM name, phone, or email and requires customers:view. Optional cursor pages forward. Default page size is 20. Does not return line items.";

const ORDERS_LIST_COUNTS_DESCRIPTION =
  "Bounded order rollup in the active company. Optional statuses (new, confirmed, canceled; max 3). Omit statuses to include every CHECK status. There is no server status named active or all — until fulfillment statuses exist, active means new plus confirmed. groupBy defaults to status (none, status, product, or customer). Product buckets include quantityMilli (sum of line quantity_milli for that SKU, across currencies). Money buckets never mix currencies.";

function statusesFilter(statuses: OrdersListPageFacadeInput["statuses"]):
  | {
      readonly statuses: NonNullable<OrdersListPageFacadeInput["statuses"]>;
    }
  | undefined {
  if (statuses === undefined) {
    return undefined;
  }
  return { statuses };
}

export function mapOrdersListPageInput(input: OrdersListPageFacadeInput): {
  readonly kind: "page.summary";
  readonly filter?: {
    readonly statuses?: NonNullable<OrdersListPageFacadeInput["statuses"]>;
    readonly query?: string;
  };
  readonly cursor?: string;
} {
  const filter = {
    ...statusesFilter(input.statuses),
    ...(input.query !== undefined ? { query: input.query } : {}),
  };
  const hasFilter = Object.keys(filter).length > 0;
  return {
    kind: "page.summary",
    ...(hasFilter ? { filter } : {}),
    ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
  };
}

export function mapOrdersListCountsInput(input: OrdersListCountsFacadeInput): {
  readonly kind: "aggregate";
  readonly filter?: {
    readonly statuses: NonNullable<OrdersListCountsFacadeInput["statuses"]>;
  };
  readonly groupBy: OrdersListCountsFacadeInput["groupBy"];
} {
  return {
    kind: "aggregate",
    ...(input.statuses !== undefined
      ? { filter: { statuses: input.statuses } }
      : {}),
    groupBy: input.groupBy,
  };
}

/**
 * Two hot ToolSet entries that still execute the `orders.list` registry
 * name (audit, permissions, timeout unchanged).
 */
export function ordersListFacadeTools(
  contract: ActionContract,
  execute: ActionToolExecute,
): Record<string, Tool> {
  return {
    [ORDERS_LIST_PAGE_TOOL_NAME]: tool({
      description: ORDERS_LIST_PAGE_DESCRIPTION,
      inputSchema: ordersListPageInputSchema,
      execute: async (input, options) => {
        const parsed = ordersListPageInputSchema.parse(input);
        const canonical = mapOrdersListPageInput(parsed);
        return execute(
          ORDERS_LIST_ACTION_NAME,
          contract.input.parse(canonical),
          {
            toolCallId: options.toolCallId,
          },
        );
      },
    }),
    [ORDERS_LIST_COUNTS_TOOL_NAME]: tool({
      description: ORDERS_LIST_COUNTS_DESCRIPTION,
      inputSchema: ordersListCountsInputSchema,
      execute: async (input, options) => {
        const parsed = ordersListCountsInputSchema.parse(input);
        const canonical = mapOrdersListCountsInput(parsed);
        return execute(
          ORDERS_LIST_ACTION_NAME,
          contract.input.parse(canonical),
          {
            toolCallId: options.toolCallId,
          },
        );
      },
    }),
  };
}
