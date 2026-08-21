import { implementAction, type AuditTargetEnv } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { z } from "zod";

import { upsertOrderCardContract } from "./upsert-order-card.contract.js";
import { upsertTenantOrderCard } from "../services/upsert-order-card.js";

const orderCardIdHolder = z.object({ orderCardId: z.string() });
const envelopeOrderIdHolder = z.object({
  payload: z.object({ orderId: z.string() }),
});

function upsertAuditTarget(env: AuditTargetEnv): { type: string; id: string } {
  const fromOutput = orderCardIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "order-card", id: fromOutput.data.orderCardId };
  }
  const fromInput = envelopeOrderIdHolder.safeParse(env.input);
  return {
    type: "order-card",
    id: fromInput.success ? fromInput.data.payload.orderId : "unknown",
  };
}

export const upsertOrderCard = implementAction(upsertOrderCardContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "system") {
      throw new CoreInvariantError("chat.upsertOrderCard expects system");
    }
    return upsertTenantOrderCard({
      ctx,
      orderId: input.payload.orderId,
    });
  },
  auditTarget: upsertAuditTarget,
});
