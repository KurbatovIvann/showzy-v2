/**
 * Named staff-assistant tools over `orders.list` (SHO-355 / SHO-356 / ADR-0033).
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

/** Duplicated from `LIST_ORDERS_CUSTOMER_IDS_MAX` — `@showzy/ai` must not import the orders module. */
export const ORDERS_LIST_CUSTOMER_IDS_MAX = 50;

const orderStatusSchema = z.enum(["new", "confirmed", "canceled"]);

const statusesField = z.array(orderStatusSchema).min(1).max(3).optional();
const queryField = z.string().trim().min(1).max(100).optional();
const cursorField = z.string().min(1).max(80).optional();
const createdFromField = z.iso.datetime().optional();
const createdToField = z.iso.datetime().optional();
const customerIdsField = z
  .array(z.uuid())
  .min(1)
  .max(ORDERS_LIST_CUSTOMER_IDS_MAX)
  .optional();

function createdIntervalIsValid(input: {
  createdFrom?: string;
  createdTo?: string;
}): boolean {
  return (
    input.createdFrom === undefined ||
    input.createdTo === undefined ||
    input.createdFrom <= input.createdTo
  );
}

const createdIntervalRefine = {
  message: "createdFrom must be less than or equal to createdTo",
} as const;

export const ordersListPageInputSchema = z
  .strictObject({
    statuses: statusesField,
    query: queryField,
    cursor: cursorField,
    createdFrom: createdFromField,
    createdTo: createdToField,
    customerIds: customerIdsField,
  })
  .refine(createdIntervalIsValid, createdIntervalRefine);

export const ordersListCountsInputSchema = z
  .strictObject({
    statuses: statusesField,
    groupBy: z
      .enum(["none", "status", "product", "customer"])
      .default("status"),
    createdFrom: createdFromField,
    createdTo: createdToField,
    customerIds: customerIdsField,
  })
  .refine(createdIntervalIsValid, createdIntervalRefine);

export type OrdersListPageFacadeInput = z.output<
  typeof ordersListPageInputSchema
>;
export type OrdersListCountsFacadeInput = z.output<
  typeof ordersListCountsInputSchema
>;

const ORDERS_LIST_PAGE_DESCRIPTION =
  "Newest-first order headers in the active company. Optional statuses (new, confirmed, canceled; max 3). Omit statuses to include every CHECK status. There is no server status named active or all — until fulfillment statuses exist, active means new plus confirmed. Optional query matches the text order number (optional leading #) or CRM name, phone, or email and requires customers:view. Optional customerIds (1–50 UUIDs). Optional createdFrom and createdTo are inclusive UTC ISO datetimes; convert staff relative language (“this week”, “today”, «цей тиждень») to an inclusive ISO interval in Europe/Kyiv, then UTC ISO on the wire. Do not pass yesterday/thisWeek enums. Optional cursor pages forward. Default page size is 20. Does not return line items. For “how many orders” / “turnover” / “gross” in a period, use orders_list_counts (do not page this tool and sum in the model).";

const ORDERS_LIST_COUNTS_DESCRIPTION =
  "Bounded order rollup in the active company. This is the tool for “how many orders” / “turnover” / “gross” in a period (groupBy none for one company rollup). Do not page orders_list_page and sum in the model. Optional statuses (new, confirmed, canceled; max 3). Omit statuses to include every CHECK status. There is no server status named active or all — until fulfillment statuses exist, active means new plus confirmed. Optional customerIds (1–50 UUIDs). Optional createdFrom and createdTo are inclusive UTC ISO datetimes; convert staff relative language (“this week”, “today”, «цей тиждень») to an inclusive ISO interval in Europe/Kyiv, then UTC ISO on the wire. Do not pass yesterday/thisWeek enums. groupBy defaults to status (none, status, product, or customer). Product buckets include quantityMilli (sum of line quantity_milli for that SKU, across currencies). Money buckets never mix currencies.";

type OrdersListMappedFilter = {
  readonly statuses?: NonNullable<OrdersListPageFacadeInput["statuses"]>;
  readonly query?: string;
  readonly createdFrom?: string;
  readonly createdTo?: string;
  readonly customerIds?: NonNullable<OrdersListPageFacadeInput["customerIds"]>;
};

function mappedOrdersListFilter(input: {
  readonly statuses?: OrdersListPageFacadeInput["statuses"];
  readonly query?: string;
  readonly createdFrom?: string;
  readonly createdTo?: string;
  readonly customerIds?: OrdersListPageFacadeInput["customerIds"];
}): OrdersListMappedFilter | undefined {
  const filter: {
    statuses?: NonNullable<OrdersListPageFacadeInput["statuses"]>;
    query?: string;
    createdFrom?: string;
    createdTo?: string;
    customerIds?: NonNullable<OrdersListPageFacadeInput["customerIds"]>;
  } = {
    ...(input.statuses !== undefined ? { statuses: input.statuses } : {}),
    ...(input.query !== undefined ? { query: input.query } : {}),
    ...(input.createdFrom !== undefined
      ? { createdFrom: input.createdFrom }
      : {}),
    ...(input.createdTo !== undefined ? { createdTo: input.createdTo } : {}),
    ...(input.customerIds !== undefined
      ? { customerIds: input.customerIds }
      : {}),
  };
  if (Object.keys(filter).length === 0) {
    return undefined;
  }
  return filter;
}

export function mapOrdersListPageInput(input: OrdersListPageFacadeInput): {
  readonly kind: "page.summary";
  readonly filter?: OrdersListMappedFilter;
  readonly cursor?: string;
} {
  const filter = mappedOrdersListFilter(input);
  return {
    kind: "page.summary",
    ...(filter !== undefined ? { filter } : {}),
    ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
  };
}

export function mapOrdersListCountsInput(input: OrdersListCountsFacadeInput): {
  readonly kind: "aggregate";
  readonly filter?: Omit<OrdersListMappedFilter, "query">;
  readonly groupBy: OrdersListCountsFacadeInput["groupBy"];
} {
  const filter = mappedOrdersListFilter({
    statuses: input.statuses,
    createdFrom: input.createdFrom,
    createdTo: input.createdTo,
    customerIds: input.customerIds,
  });
  return {
    kind: "aggregate",
    ...(filter !== undefined ? { filter } : {}),
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
