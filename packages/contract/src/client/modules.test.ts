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
  archiveCustomerContract,
  createCounterpartyContract,
  createCustomerContract,
  createGroupContract,
  deleteCounterpartyContract,
  deleteCustomerContract,
  deleteGroupContract,
  getCounterpartyContract,
  getCustomerContract,
  getGroupContract,
  listCounterpartiesContract,
  listCustomersContract,
  listGroupsContract,
  restoreCustomerContract,
  updateCounterpartyContract,
  updateCustomerContract,
  updateGroupContract,
} from "@showzy/customers/contract";
import {
  finalizeUploadContract,
  getDownloadUrlContract,
  getDownloadUrlsContract,
  getUploadUrlContract,
  requestUploadContract,
} from "@showzy/files/contract";
import {
  acceptInviteContract,
  createInviteContract,
  getInviteContract,
  listInvitesContract,
  revokeInviteContract,
} from "@showzy/invites/contract";
import {
  cancelOrderContract,
  confirmOrderContract,
  createOrderContract,
  getOrderContract,
  listOrdersContract,
} from "@showzy/orders/contract";
import {
  activatePriceListContract,
  createPriceListContract,
  deactivatePriceListContract,
  deletePriceListContract,
  getPriceListContract,
  listPriceListEntriesContract,
  listPriceListsContract,
  removePriceListEntriesContract,
  resolveProductPricesContract,
  setDefaultPriceListContract,
  setPriceListEntriesContract,
  updatePriceListContract,
} from "@showzy/pricing/contract";

import { contractModules, contractRouter } from "./modules.js";

describe("client composition", () => {
  it("exposes client catalog, chat, companies, customers, files, invites, orders, and pricing actions and no internal facts actions", () => {
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
      customers: {
        archiveCustomer: archiveCustomerContract,
        createCounterparty: createCounterpartyContract,
        createCustomer: createCustomerContract,
        createGroup: createGroupContract,
        deleteCounterparty: deleteCounterpartyContract,
        deleteCustomer: deleteCustomerContract,
        deleteGroup: deleteGroupContract,
        getCounterparty: getCounterpartyContract,
        getCustomer: getCustomerContract,
        getGroup: getGroupContract,
        listCounterparties: listCounterpartiesContract,
        listCustomers: listCustomersContract,
        listGroups: listGroupsContract,
        restoreCustomer: restoreCustomerContract,
        updateCounterparty: updateCounterpartyContract,
        updateCustomer: updateCustomerContract,
        updateGroup: updateGroupContract,
      },
      files: {
        requestUpload: requestUploadContract,
        getUploadUrl: getUploadUrlContract,
        finalizeUpload: finalizeUploadContract,
        getDownloadUrl: getDownloadUrlContract,
        getDownloadUrls: getDownloadUrlsContract,
      },
      invites: {
        accept: acceptInviteContract,
        create: createInviteContract,
        get: getInviteContract,
        list: listInvitesContract,
        revoke: revokeInviteContract,
      },
      orders: {
        create: createOrderContract,
        confirm: confirmOrderContract,
        cancel: cancelOrderContract,
        get: getOrderContract,
        list: listOrdersContract,
      },
      pricing: {
        activatePriceList: activatePriceListContract,
        createPriceList: createPriceListContract,
        deactivatePriceList: deactivatePriceListContract,
        deletePriceList: deletePriceListContract,
        getPriceList: getPriceListContract,
        listPriceListEntries: listPriceListEntriesContract,
        listPriceLists: listPriceListsContract,
        removePriceListEntries: removePriceListEntriesContract,
        resolveProductPrices: resolveProductPricesContract,
        setDefaultPriceList: setDefaultPriceListContract,
        setPriceListEntries: setPriceListEntriesContract,
        updatePriceList: updatePriceListContract,
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
    expect(contractRouter.companies.get).toBeDefined();
    expect(contractRouter.companies.listMine).toBeDefined();
    expect(contractRouter.companies.updateLegal).toBeDefined();
    expect(contractRouter.customers.archiveCustomer).toBeDefined();
    expect(contractRouter.customers.createCounterparty).toBeDefined();
    expect(contractRouter.customers.createCustomer).toBeDefined();
    expect(contractRouter.customers.createGroup).toBeDefined();
    expect(contractRouter.customers.deleteCounterparty).toBeDefined();
    expect(contractRouter.customers.deleteCustomer).toBeDefined();
    expect(contractRouter.customers.deleteGroup).toBeDefined();
    expect(contractRouter.customers.getCounterparty).toBeDefined();
    expect(contractRouter.customers.getCustomer).toBeDefined();
    expect(contractRouter.customers.getGroup).toBeDefined();
    expect(contractRouter.customers.listCounterparties).toBeDefined();
    expect(contractRouter.customers.listCustomers).toBeDefined();
    expect(contractRouter.customers.listGroups).toBeDefined();
    expect(contractRouter.customers.restoreCustomer).toBeDefined();
    expect(contractRouter.customers.updateCounterparty).toBeDefined();
    expect(contractRouter.customers.updateCustomer).toBeDefined();
    expect(contractRouter.customers.updateGroup).toBeDefined();
    expect(contractModules.customers).not.toHaveProperty(
      "getCustomerPricingFacts",
    );
    expect(contractModules.customers).not.toHaveProperty("applyInviteCrm");
    expect(contractRouter.files.requestUpload).toBeDefined();
    expect(contractRouter.files.getUploadUrl).toBeDefined();
    expect(contractRouter.files.finalizeUpload).toBeDefined();
    expect(contractRouter.files.getDownloadUrl).toBeDefined();
    expect(contractRouter.files.getDownloadUrls).toBeDefined();
    expect(contractModules.files).not.toHaveProperty("getAttachmentFacts");
    expect(contractModules.files).not.toHaveProperty("sweepAbandonedUploads");
    expect(contractRouter.invites.accept).toBeDefined();
    expect(contractRouter.invites.create).toBeDefined();
    expect(contractRouter.invites.get).toBeDefined();
    expect(contractRouter.invites.list).toBeDefined();
    expect(contractRouter.invites.revoke).toBeDefined();
    expect(contractRouter.orders.create).toBeDefined();
    expect(contractRouter.orders.confirm).toBeDefined();
    expect(contractRouter.orders.cancel).toBeDefined();
    expect(contractRouter.orders.get).toBeDefined();
    expect(contractRouter.orders.list).toBeDefined();
    expect(contractRouter.pricing.activatePriceList).toBeDefined();
    expect(contractRouter.pricing.createPriceList).toBeDefined();
    expect(contractRouter.pricing.deactivatePriceList).toBeDefined();
    expect(contractRouter.pricing.deletePriceList).toBeDefined();
    expect(contractRouter.pricing.getPriceList).toBeDefined();
    expect(contractRouter.pricing.listPriceListEntries).toBeDefined();
    expect(contractRouter.pricing.listPriceLists).toBeDefined();
    expect(contractRouter.pricing.removePriceListEntries).toBeDefined();
    expect(contractRouter.pricing.resolveProductPrices).toBeDefined();
    expect(contractRouter.pricing.setDefaultPriceList).toBeDefined();
    expect(contractRouter.pricing.setPriceListEntries).toBeDefined();
    expect(contractRouter.pricing.updatePriceList).toBeDefined();
  });
});
