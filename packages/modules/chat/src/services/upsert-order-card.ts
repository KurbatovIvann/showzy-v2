import type { ActionCtx } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  NotFoundError,
} from "@showzy/core/errors";
import { orderCards } from "@showzy/db/schema/chat";
import { postgresError } from "@showzy/module-kit/postgres-unique";
import { and, eq } from "drizzle-orm";

import { requireWritable } from "./writable.js";

type UpsertResult = {
  readonly orderCardId: string;
  readonly revision: number;
  readonly applied: true;
};

export function mapOrderCardInsertViolation(error: unknown): unknown {
  const pg = postgresError(error);
  if (pg?.code === "23503") {
    return new NotFoundError();
  }
  if (pg?.code === "23505") {
    return new ConflictError("Order card already exists.");
  }
  return error;
}

export async function upsertTenantOrderCard(env: {
  readonly ctx: Extract<ActionCtx, { principal: "system" }>;
  readonly orderId: string;
}): Promise<UpsertResult> {
  if (env.ctx.scope !== "tenant") {
    throw new CoreInvariantError("chat.upsertOrderCard expects tenant system");
  }
  const db = requireWritable(env.ctx.db);
  const companyId = env.ctx.companyId;

  const existing = await db
    .select({
      id: orderCards.id,
      revision: orderCards.revision,
    })
    .from(orderCards)
    .where(
      and(
        eq(orderCards.companyId, companyId),
        eq(orderCards.orderId, env.orderId),
      ),
    )
    .limit(1)
    .for("update");
  const current = existing[0];
  if (current !== undefined) {
    const bumped = await db
      .update(orderCards)
      .set({ revision: current.revision + 1 })
      .where(
        and(eq(orderCards.companyId, companyId), eq(orderCards.id, current.id)),
      )
      .returning({
        id: orderCards.id,
        revision: orderCards.revision,
      });
    const saved = bumped[0];
    if (saved === undefined) {
      throw new CoreInvariantError("chat.upsertOrderCard bump returned no row");
    }
    return {
      orderCardId: saved.id,
      revision: saved.revision,
      applied: true,
    };
  }

  try {
    const inserted = await db
      .insert(orderCards)
      .values({
        companyId,
        orderId: env.orderId,
        revision: 1,
      })
      .returning({
        id: orderCards.id,
        revision: orderCards.revision,
      });
    const created = inserted[0];
    if (created === undefined) {
      throw new CoreInvariantError(
        "chat.upsertOrderCard insert returned no row",
      );
    }
    return {
      orderCardId: created.id,
      revision: created.revision,
      applied: true,
    };
  } catch (error) {
    throw mapOrderCardInsertViolation(error);
  }
}
