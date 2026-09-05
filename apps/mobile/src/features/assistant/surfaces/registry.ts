/**
 * Result-card surface registry (SHO-385). Each kind owns the façade tools
 * it binds, parse, English `promptLine` (for T3 to copy into
 * `<presentation>`), and a React card in `sheet/`. Timeline and HITL are
 * not registered here. Do not import `@showzy/ai`. Do not put this in
 * `@showzy/contract`.
 *
 * Adding the **second list-shaped** surface (customers, price lists):
 * build it generic — one card driven by a typed column descriptor — and
 * move `orders-list` onto it in the same PR. Do not copy `orders-list.ts`
 * and swap the columns.
 *
 * Not done already because there is nothing to generalise from yet:
 * `orders-list` is the only table here. `orders-aggregate` (buckets,
 * groupBy inference) and `order-entity` (one record) are different
 * shapes, and what they genuinely share already lives in `./helpers`.
 * An abstraction derived from one example is the wrong abstraction —
 * wait for the second real case, then derive it from both.
 */
import type { Locale } from "../../../i18n/locale";
import type { AssistantChatPart } from "../shared/confirmation-presenter";
import type { AssistantSurface } from "./compose";
import {
  ORDERS_AGGREGATE_PROMPT_LINE,
  ORDERS_AGGREGATE_SURFACE_TOOLS,
  parseOrdersAggregateSurface,
} from "./orders-aggregate";
import {
  ORDER_ENTITY_PROMPT_LINE,
  ORDER_ENTITY_SURFACE_TOOLS,
  parseOrderEntitySurfaces,
} from "./order-entity";
import {
  ORDERS_LIST_PROMPT_LINE,
  ORDERS_LIST_SURFACE_TOOLS,
  parseOrdersListSurface,
} from "./orders-list";

export type AssistantResultSurfaceKind = AssistantSurface["kind"];

type AssistantSurfaceParse =
  | ((
      parts: readonly AssistantChatPart[],
      locale: Locale,
    ) => AssistantSurface | null)
  | ((
      parts: readonly AssistantChatPart[],
      locale: Locale,
    ) => readonly AssistantSurface[]);

export type AssistantResultSurfaceDefinition = {
  readonly kind: AssistantResultSurfaceKind;
  readonly toolNames: readonly string[];
  readonly promptLine: string;
  readonly parse: AssistantSurfaceParse;
};

export const ASSISTANT_RESULT_SURFACE_REGISTRY: readonly AssistantResultSurfaceDefinition[] =
  [
    {
      kind: "orders-list",
      toolNames: ORDERS_LIST_SURFACE_TOOLS,
      promptLine: ORDERS_LIST_PROMPT_LINE,
      parse: parseOrdersListSurface,
    },
    {
      kind: "orders-aggregate",
      toolNames: ORDERS_AGGREGATE_SURFACE_TOOLS,
      promptLine: ORDERS_AGGREGATE_PROMPT_LINE,
      parse: parseOrdersAggregateSurface,
    },
    {
      kind: "order-entity",
      toolNames: ORDER_ENTITY_SURFACE_TOOLS,
      promptLine: ORDER_ENTITY_PROMPT_LINE,
      parse: parseOrderEntitySurfaces,
    },
  ];
