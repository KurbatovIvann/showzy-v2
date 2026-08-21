import { describe, expect, it } from "vitest";

import { getOrderCardContract } from "@showzy/chat/contract";
import {
  confirmOrderContract,
  createOrderContract,
  getOrderContract,
} from "@showzy/orders/contract";
import { resolveProductPricesContract } from "@showzy/pricing/contract";

import { contractModules, contractRouter } from "./modules.js";

describe("client composition", () => {
  it("exposes staff client chat, orders, and pricing actions and no internal facts actions", () => {
    expect(contractModules).toEqual({
      chat: {
        getOrderCard: getOrderCardContract,
      },
      orders: {
        create: createOrderContract,
        confirm: confirmOrderContract,
        get: getOrderContract,
      },
      pricing: {
        resolveProductPrices: resolveProductPricesContract,
      },
    });
    expect(contractRouter.chat.getOrderCard).toBeDefined();
    expect(contractRouter.orders.create).toBeDefined();
    expect(contractRouter.orders.confirm).toBeDefined();
    expect(contractRouter.orders.get).toBeDefined();
    expect(contractRouter.pricing.resolveProductPrices).toBeDefined();
  });
});
