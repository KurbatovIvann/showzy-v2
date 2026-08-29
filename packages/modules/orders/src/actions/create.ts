import { getProductOrderFacts } from "@showzy/catalog";
import { getCompany } from "@showzy/companies";
import { implementAction, type AuditTargetEnv } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { resolveProductPrices } from "@showzy/pricing";
import { z } from "zod";

import { createStaffOrder } from "../services/create-order.js";
import { createOrderContract } from "./create.contract.js";

const orderIdHolder = z.object({ orderId: z.string() });
const customerIdHolder = z.object({ customerId: z.string() });

function createAuditTarget(env: AuditTargetEnv): { type: string; id: string } {
  const fromOutput = orderIdHolder.safeParse(env.output);
  if (fromOutput.success) {
    return { type: "order", id: fromOutput.data.orderId };
  }
  const fromInput = customerIdHolder.safeParse(env.input);
  return {
    type: "order",
    id: fromInput.success ? fromInput.data.customerId : "uncreated",
  };
}

export const createOrder = implementAction(createOrderContract, {
  handler: async (input, ctx) => {
    if (ctx.principal !== "staff") {
      throw new CoreInvariantError("orders.create expects staff");
    }

    const company = await ctx.call(getCompany, {});
    const catalog = await ctx.call(getProductOrderFacts, {
      items: input.items.map((item) => ({
        productId: item.productId,
        ...(item.variantId === undefined ? {} : { variantId: item.variantId }),
      })),
    });
    const priced = await ctx.call(resolveProductPrices, {
      items: input.items.map((item) => ({
        productId: item.productId,
        ...(item.variantId === undefined ? {} : { variantId: item.variantId }),
      })),
      customerId: input.customerId,
    });

    return createStaffOrder({
      ctx,
      input,
      numberingPrefix: company.prefix,
      products: catalog.products,
      prices: priced.prices,
    });
  },
  auditTarget: createAuditTarget,
});
