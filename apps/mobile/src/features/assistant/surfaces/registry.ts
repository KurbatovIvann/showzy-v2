/**
 * Result-card surface registry (SHO-385). Each kind owns the façade tools
 * it binds, parse, English `promptLine` (for T3 to copy into
 * `<presentation>`), and a React card in `sheet/`. Timeline and HITL are
 * not registered here. Do not import `@showzy/ai`. Do not put this in
 * `@showzy/contract`.
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
