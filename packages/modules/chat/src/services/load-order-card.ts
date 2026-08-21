import type { ActionCtx } from "@showzy/core";
import { NotFoundError } from "@showzy/core/errors";
import { orderCards } from "@showzy/db/schema/chat";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import { getOrderCardOutputSchema } from "../actions/get-order-card.contract.js";

type StaffDb = Extract<ActionCtx, { principal: "staff" }>["db"];
type OrderCardView = z.output<typeof getOrderCardOutputSchema>;

export async function loadStaffOrderCard(env: {
  readonly db: StaffDb;
  readonly companyId: string;
  readonly orderId: string;
}): Promise<OrderCardView> {
  const rows = await env.db
    .select({
      id: orderCards.id,
      orderId: orderCards.orderId,
      revision: orderCards.revision,
      createdAt: orderCards.createdAt,
      updatedAt: orderCards.updatedAt,
    })
    .from(orderCards)
    .where(
      and(
        eq(orderCards.companyId, env.companyId),
        eq(orderCards.orderId, env.orderId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new NotFoundError();
  }
  return {
    id: row.id,
    orderId: row.orderId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
