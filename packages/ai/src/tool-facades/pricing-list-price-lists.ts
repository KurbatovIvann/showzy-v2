/**
 * Named staff-assistant tool over `pricing.listPriceLists` (SHO-358 / ADR-0033).
 *
 * Presentation adapter only: `execute("pricing.listPriceLists", canonical)`.
 * Do not add `pricing.listForAssistant`. Do not flatten
 * `list-price-lists.contract.ts`. Do not hot-load every pricing write.
 */
import type { ActionContract } from "@showzy/core/contract";
import { tool, type Tool } from "ai";
import { z } from "zod";

import type { ActionToolExecute } from "../action-tool.js";

export const PRICING_LIST_PRICE_LISTS_ACTION_NAME = "pricing.listPriceLists";
export const PRICING_LIST_PRICE_LISTS_TOOL_NAME = "pricing_list_price_lists";
export const PRICING_CREATE_PRICE_LIST_ACTION_NAME = "pricing.createPriceList";
export const PRICING_SET_PRICE_LIST_ENTRIES_ACTION_NAME =
  "pricing.setPriceListEntries";

/** Duplicated from `LIST_PRICE_LISTS_DEFAULT_LIMIT` — `@showzy/ai` must not import pricing. */
export const LIST_PRICE_LISTS_DEFAULT_LIMIT = 20;
/** Duplicated from `LIST_PRICE_LISTS_MAX_LIMIT`. */
export const LIST_PRICE_LISTS_MAX_LIMIT = 50;
/** Duplicated from `LIST_PRICE_LISTS_QUERY_MAX`. */
export const LIST_PRICE_LISTS_QUERY_MAX = 100;
/** Duplicated from `LIST_PRICE_LISTS_CURSOR_MAX`. */
export const LIST_PRICE_LISTS_CURSOR_MAX = 200;

export const pricingListPriceListsInputSchema = z.strictObject({
  query: z.string().trim().min(1).max(LIST_PRICE_LISTS_QUERY_MAX).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIST_PRICE_LISTS_MAX_LIMIT)
    .default(LIST_PRICE_LISTS_DEFAULT_LIMIT),
  cursor: z.string().min(1).max(LIST_PRICE_LISTS_CURSOR_MAX).optional(),
});

export type PricingListPriceListsFacadeInput = z.output<
  typeof pricingListPriceListsInputSchema
>;

const PRICING_LIST_PRICE_LISTS_DESCRIPTION =
  "Price lists in the active company: id, name, isDefault, isActive, entryCount, and nextCursor. Optional case-insensitive name query. Optional cursor pages forward. Default page size is 20, cap 50. Includes inactive lists. Find a list by name with this tool before creating a duplicate with pricing.createPriceList. After create, fill markup with pricing.setPriceListEntries using catalog_list_products compact prices. Do not tell the staff member the list-price tool is missing until search returned nothing.";

/** Appended to the 1:1 deferred create tool so BM25 still sees the contract text. */
export const PRICING_CREATE_PRICE_LIST_DESCRIPTION_SUFFIX =
  "Find a list by name with pricing_list_price_lists before creating a duplicate. After create, fill with pricing.setPriceListEntries using catalog_list_products compact prices.";

/** Appended to the 1:1 deferred set-entries tool. Do not wrap the write schema. */
export const PRICING_SET_PRICE_LIST_ENTRIES_DESCRIPTION_SUFFIX =
  "Fill markup from catalog_list_products compact prices. Resolve the list by name with pricing_list_price_lists first.";

export const PRICING_DEFERRED_TOOL_DESCRIPTION_SUFFIXES: Readonly<
  Record<string, string>
> = {
  [PRICING_CREATE_PRICE_LIST_ACTION_NAME]:
    PRICING_CREATE_PRICE_LIST_DESCRIPTION_SUFFIX,
  [PRICING_SET_PRICE_LIST_ENTRIES_ACTION_NAME]:
    PRICING_SET_PRICE_LIST_ENTRIES_DESCRIPTION_SUFFIX,
};

export function mapPricingListPriceListsInput(
  input: PricingListPriceListsFacadeInput,
): {
  readonly query?: string;
  readonly limit: number;
  readonly cursor?: string;
} {
  return {
    ...(input.query !== undefined ? { query: input.query } : {}),
    limit: input.limit,
    ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapPricingListPriceListsCompactRow(row: unknown): unknown {
  if (!isRecord(row)) {
    return row;
  }
  return {
    id: row["id"],
    name: row["name"],
    isDefault: row["isDefault"],
    isActive: row["isActive"],
    entryCount: row["entryCount"],
  };
}

/**
 * Assistant view of `pricing.listPriceLists`. The contract row is already
 * this shape; keep `entryCount` for find-by-name / assign. Typed errors
 * pass through unchanged.
 */
export function mapPricingListPriceListsOutput(output: unknown): unknown {
  if (!isRecord(output) || !Array.isArray(output["items"])) {
    return output;
  }
  const nextCursor = output["nextCursor"];
  return {
    items: output["items"].map((row) =>
      mapPricingListPriceListsCompactRow(row),
    ),
    nextCursor: nextCursor === undefined ? null : nextCursor,
  };
}

/**
 * One hot ToolSet entry that still executes the `pricing.listPriceLists`
 * registry name (audit, permissions, timeout unchanged). Canonical parse
 * fills `availability: "all"` from the contract default.
 */
export function pricingListPriceListsFacadeTools(
  contract: ActionContract,
  execute: ActionToolExecute,
): Record<string, Tool> {
  return {
    [PRICING_LIST_PRICE_LISTS_TOOL_NAME]: tool({
      description: PRICING_LIST_PRICE_LISTS_DESCRIPTION,
      inputSchema: pricingListPriceListsInputSchema,
      execute: async (input, options) => {
        const parsed = pricingListPriceListsInputSchema.parse(input);
        const canonical = mapPricingListPriceListsInput(parsed);
        const raw = await execute(
          PRICING_LIST_PRICE_LISTS_ACTION_NAME,
          contract.input.parse(canonical),
          {
            toolCallId: options.toolCallId,
          },
        );
        return mapPricingListPriceListsOutput(raw);
      },
    }),
  };
}
