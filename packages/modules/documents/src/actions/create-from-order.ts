import { getSellerFacts } from "@showzy/companies";
import { implementAction, type AuditTargetEnv } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { getCounterparty, getCustomer } from "@showzy/customers";
import { getOrder } from "@showzy/orders";
import { z } from "zod";

import { createFromOrderContract } from "./create-from-order.contract.js";
import { createStaffDocument } from "../services/create-from-order.js";
import {
  requireCounterpartyCustomerMatch,
  requireOrderCustomerId,
  snapshotCounterpartyBuyer,
  snapshotCustomerBuyer,
} from "../services/snapshots.js";

const documentIdHolder = z.object({ documentId: z.string() });
const orderIdHolder = z.object({ orderId: z.string() });

function createAuditTarget(env: AuditTargetEnv): { type: string; id: string } {
  const fromOutput = documentIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "document", id: fromOutput.data.documentId };
  }
  const fromInput = orderIdHolder.safeParse(env.input);
  return {
    type: "document",
    id: fromInput.success ? fromInput.data.orderId : "uncreated",
  };
}

export const createFromOrder = implementAction(createFromOrderContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("documents.createFromOrder expects staff");
    }

    const order = await ctx.call(getOrder, { orderId: input.orderId });
    const seller = await ctx.call(getSellerFacts, {});

    if (input.counterpartyId !== undefined) {
      const counterparty = await ctx.call(getCounterparty, {
        id: input.counterpartyId,
      });
      requireCounterpartyCustomerMatch(
        counterparty.customerId,
        order.customerId,
      );
      return createStaffDocument({
        ctx,
        input,
        order,
        seller,
        buyer: snapshotCounterpartyBuyer(counterparty),
        counterpartyId: counterparty.id,
      });
    }

    const customerId = requireOrderCustomerId(order.customerId);
    const customer = await ctx.call(getCustomer, { id: customerId });
    return createStaffDocument({
      ctx,
      input,
      order,
      seller,
      buyer: snapshotCustomerBuyer(customer.name),
      counterpartyId: null,
    });
  },
  auditTarget: createAuditTarget,
});
