import { memo } from "react";

import type { AssistantSurface } from "../surfaces";
import { OrderEntityCard } from "./order-entity-card";
import { OrdersAggregateResultCard } from "./orders-aggregate-result-card";
import { OrdersListResultCard } from "./orders-list-result-card";

/**
 * SHO-385: one switch for registered result-card kinds. Timeline and HITL
 * stay in the message row, outside this registry.
 */
export const AssistantSurfaceCard = memo(function AssistantSurfaceCard(props: {
  readonly surface: AssistantSurface;
  readonly onOpenHref: (href: string) => void;
}) {
  const { surface, onOpenHref } = props;
  switch (surface.kind) {
    case "orders-list":
      return <OrdersListResultCard card={surface} onOpenHref={onOpenHref} />;
    case "orders-aggregate":
      return <OrdersAggregateResultCard card={surface} />;
    case "order-entity":
      return <OrderEntityCard card={surface} onOpenHref={onOpenHref} />;
  }
});
