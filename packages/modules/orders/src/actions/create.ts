import { getProductOrderFacts } from "@showzy/catalog";
import { getCompany } from "@showzy/companies";
import { implementAction } from "@showzy/core";
import { CoreInvariantError } from "@showzy/core/errors";
import { createAuditTarget, pickString } from "@showzy/module-kit/audit-target";
import { resolveProductPrices } from "@showzy/pricing";
import { z } from "zod";

import { createStaffOrder } from "../services/create-order.js";
import { createOrderContract } from "./create.contract.js";

const createOrderAuditTarget = createAuditTarget({
  type: "order",
  fallback: "uncreated",
  steps: [
    {
      source: "output",
      schema: z.object({ orderId: z.string() }),
      pick: (data) => pickString("orderId", data),
    },
    {
      source: "input",
      schema: z.object({ customerId: z.string() }),
      pick: (data) => pickString("customerId", data),
    },
  ],
});

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
  auditTarget: createOrderAuditTarget,
});
