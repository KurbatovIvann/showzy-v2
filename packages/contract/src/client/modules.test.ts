import { describe, expect, it } from "vitest";

import { getOrderCardContract } from "@showzy/chat/contract";
import { listMineContract } from "@showzy/companies/contract";
import {
  finalizeUploadContract,
  getDownloadUrlContract,
  getUploadUrlContract,
  requestUploadContract,
} from "@showzy/files/contract";
import {
  confirmOrderContract,
  createOrderContract,
  getOrderContract,
} from "@showzy/orders/contract";
import { resolveProductPricesContract } from "@showzy/pricing/contract";

import { contractModules, contractRouter } from "./modules.js";

describe("client composition", () => {
  it("exposes client chat, companies, files, orders, and pricing actions and no internal facts actions", () => {
    expect(contractModules).toEqual({
      chat: {
        getOrderCard: getOrderCardContract,
      },
      companies: {
        listMine: listMineContract,
      },
      files: {
        requestUpload: requestUploadContract,
        getUploadUrl: getUploadUrlContract,
        finalizeUpload: finalizeUploadContract,
        getDownloadUrl: getDownloadUrlContract,
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
    expect(contractRouter.companies.listMine).toBeDefined();
    expect(contractRouter.files.requestUpload).toBeDefined();
    expect(contractRouter.files.getUploadUrl).toBeDefined();
    expect(contractRouter.files.finalizeUpload).toBeDefined();
    expect(contractRouter.files.getDownloadUrl).toBeDefined();
    expect(contractModules.files).not.toHaveProperty("getAttachmentFacts");
    expect(contractModules.files).not.toHaveProperty("sweepAbandonedUploads");
    expect(contractRouter.orders.create).toBeDefined();
    expect(contractRouter.orders.confirm).toBeDefined();
    expect(contractRouter.orders.get).toBeDefined();
    expect(contractRouter.pricing.resolveProductPrices).toBeDefined();
  });
});
