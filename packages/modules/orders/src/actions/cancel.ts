import { implementAction, type AuditTargetEnv } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  NotFoundError,
} from "@showzy/core/errors";
import { orders } from "@showzy/db/schema/orders";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { ordersCanceled } from "../events/canceled.js";
import { requireWritable } from "../services/writable.js";
import { cancelOrderContract } from "./cancel.contract.js";

const orderIdHolder = z.object({ orderId: z.string() });

function cancelAuditTarget(env: AuditTargetEnv): { type: string; id: string } {
  const parsed = orderIdHolder.safeParse(env.input);
  return {
    type: "order",
    id: parsed.success ? parsed.data.orderId : "unknown",
  };
}

export const cancelOrder = implementAction(cancelOrderContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("orders.cancel expects staff");
    }

    const db = requireWritable(ctx.db);
    const rows = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.companyId, ctx.companyId), eq(orders.id, input.orderId)),
      )
      .limit(1)
      .for("update");
    const row = rows[0];
    if (row === undefined) {
      throw new NotFoundError();
    }
    if (row.status === "canceled") {
      throw new ConflictError("Order is already canceled.");
    }
    if (row.status !== "new" && row.status !== "confirmed") {
      throw new ConflictError("Order cannot be canceled.");
    }

    const updated = await db
      .update(orders)
      .set({ status: "canceled" })
      .where(
        and(eq(orders.companyId, ctx.companyId), eq(orders.id, input.orderId)),
      )
      .returning({
        customerId: orders.customerId,
      });
    const saved = updated[0];
    if (saved === undefined) {
      throw new CoreInvariantError("orders.cancel update returned no row");
    }

    ctx.emit(ordersCanceled, {
      aggregate: { type: "order", id: input.orderId },
      payload: {
        orderId: input.orderId,
        customerId: saved.customerId,
      },
    });

    return {
      orderId: input.orderId,
      customerId: saved.customerId,
      status: "canceled" as const,
    };
  },
  auditTarget: cancelAuditTarget,
});
