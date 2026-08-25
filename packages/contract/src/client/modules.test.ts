import { describe, expect, it } from "vitest";

import {
  archiveProductContract,
  archiveVariantContract,
  createProductContract,
  createVariantContract,
  getProductContract,
  listProductsContract,
  restoreProductContract,
  restoreVariantContract,
  setProductImagesContract,
  updateProductContract,
  updateVariantContract,
} from "@showzy/catalog/contract";
import { getOrderCardContract } from "@showzy/chat/contract";
import {
  createCompanyContract,
  listMineContract,
} from "@showzy/companies/contract";
import {
  finalizeUploadContract,
  getDownloadUrlContract,
  getDownloadUrlsContract,
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
  it("exposes client catalog, chat, companies, files, orders, and pricing actions and no internal facts actions", () => {
    expect(contractModules).toEqual({
      catalog: {
        createProduct: createProductContract,
        createVariant: createVariantContract,
        getProduct: getProductContract,
        listProducts: listProductsContract,
        updateProduct: updateProductContract,
        updateVariant: updateVariantContract,
        archiveProduct: archiveProductContract,
        restoreProduct: restoreProductContract,
        archiveVariant: archiveVariantContract,
        restoreVariant: restoreVariantContract,
        setProductImages: setProductImagesContract,
      },
      chat: {
        getOrderCard: getOrderCardContract,
      },
      companies: {
        create: createCompanyContract,
        listMine: listMineContract,
      },
      files: {
        requestUpload: requestUploadContract,
        getUploadUrl: getUploadUrlContract,
        finalizeUpload: finalizeUploadContract,
        getDownloadUrl: getDownloadUrlContract,
        getDownloadUrls: getDownloadUrlsContract,
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
    expect(contractRouter.catalog.createProduct).toBeDefined();
    expect(contractRouter.catalog.createVariant).toBeDefined();
    expect(contractRouter.catalog.getProduct).toBeDefined();
    expect(contractRouter.catalog.listProducts).toBeDefined();
    expect(contractRouter.catalog.updateProduct).toBeDefined();
    expect(contractRouter.catalog.updateVariant).toBeDefined();
    expect(contractRouter.catalog.archiveProduct).toBeDefined();
    expect(contractRouter.catalog.restoreProduct).toBeDefined();
    expect(contractRouter.catalog.archiveVariant).toBeDefined();
    expect(contractRouter.catalog.restoreVariant).toBeDefined();
    expect(contractRouter.catalog.setProductImages).toBeDefined();
    expect(contractModules.catalog).not.toHaveProperty("getProductOrderFacts");
    expect(contractModules.catalog).not.toHaveProperty(
      "getProductPricingFacts",
    );
    expect(contractRouter.chat.getOrderCard).toBeDefined();
    expect(contractRouter.companies.create).toBeDefined();
    expect(contractRouter.companies.listMine).toBeDefined();
    expect(contractRouter.files.requestUpload).toBeDefined();
    expect(contractRouter.files.getUploadUrl).toBeDefined();
    expect(contractRouter.files.finalizeUpload).toBeDefined();
    expect(contractRouter.files.getDownloadUrl).toBeDefined();
    expect(contractRouter.files.getDownloadUrls).toBeDefined();
    expect(contractModules.files).not.toHaveProperty("getAttachmentFacts");
    expect(contractModules.files).not.toHaveProperty("sweepAbandonedUploads");
    expect(contractRouter.orders.create).toBeDefined();
    expect(contractRouter.orders.confirm).toBeDefined();
    expect(contractRouter.orders.get).toBeDefined();
    expect(contractRouter.pricing.resolveProductPrices).toBeDefined();
  });
});
