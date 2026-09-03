/**
 * SHO-367 / SHO-385 compose: page (+ optional counts) → one list surface;
 * counts-only → one aggregate; never both; N entity surfaces from
 * get/create. Do not walk `items[].orderId` into entities.
 */
import type { Locale } from "../../../i18n/locale";
import type { AssistantChatPart } from "../shared/confirmation-presenter";
import type { AssistantOrdersAggregateCardView } from "./orders-aggregate";
import { parseOrdersAggregateSurface } from "./orders-aggregate";
import type { AssistantOrderEntityCardView } from "./order-entity";
import { parseOrderEntitySurfaces } from "./order-entity";
import type { AssistantOrdersListCardView } from "./orders-list";
import { parseOrdersListSurface } from "./orders-list";

export type AssistantSurface =
  | AssistantOrdersListCardView
  | AssistantOrdersAggregateCardView
  | AssistantOrderEntityCardView;

export function assistantSurfaceKey(surface: AssistantSurface): string {
  switch (surface.kind) {
    case "orders-list":
      return "orders-list";
    case "orders-aggregate":
      return "orders-aggregate";
    case "order-entity":
      return surface.id;
  }
}

/**
 * Discriminated result-card surfaces for one assistant turn. Timeline and
 * HITL confirmation stay outside this list.
 */
export function assistantSurfacesFromParts(
  parts: readonly AssistantChatPart[],
  locale: Locale,
): readonly AssistantSurface[] {
  const list = parseOrdersListSurface(parts, locale);
  const aggregate =
    list === null ? parseOrdersAggregateSurface(parts, locale) : null;
  const entities = parseOrderEntitySurfaces(parts, locale);
  const surfaces: AssistantSurface[] = [];
  if (list !== null) {
    surfaces.push(list);
  }
  if (aggregate !== null) {
    surfaces.push(aggregate);
  }
  surfaces.push(...entities);
  return surfaces;
}
