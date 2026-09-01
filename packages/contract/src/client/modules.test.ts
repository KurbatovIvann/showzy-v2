import { describe, expect, it } from "vitest";

import {
  appendUserMessageContract,
  createConversationContract,
  getConversationContract,
  listConversationsContract,
} from "@showzy/assistant/contract";
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
  getCompanyContract,
  listMineContract,
  updateLegalContract,
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
  cancelDocumentContract,
  createFromOrderContract,
  getDocumentContract,
  getSharedContract,
  listDocumentsContract,
  requestSignContract,
  shareDocumentContract,
} from "@showzy/documents/contract";
import {
  completeSigningContract,
  getSigningContract,
  startSigningContract,
} from "@showzy/doc-signing/contract";
import {
  finalizeUploadContract,
  getDownloadUrlContract,
  getDownloadUrlsContract,
  getSigningUploadUrlContract,
  getUploadUrlContract,
  requestSigningUploadContract,
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

import { deriveAiToolSources } from "./ai-manifest.js";
import { contractModules, contractRouter } from "./modules.js";

describe("client composition", () => {
  it("exposes client catalog, chat, companies, customers, documents, docSigning, files, invites, orders, pricing, and assistant actions and no internal facts actions", () => {
    expect(contractModules).toEqual({
      assistant: {
        createConversation: createConversationContract,
        listConversations: listConversationsContract,
        getConversation: getConversationContract,
        appendUserMessage: appendUserMessageContract,
      },
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
        get: getCompanyContract,
        listMine: listMineContract,
        updateLegal: updateLegalContract,
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
      documents: {
        cancel: cancelDocumentContract,
        createFromOrder: createFromOrderContract,
        get: getDocumentContract,
        getShared: getSharedContract,
        list: listDocumentsContract,
        requestSign: requestSignContract,
        share: shareDocumentContract,
      },
      docSigning: {
        complete: completeSigningContract,
        get: getSigningContract,
        start: startSigningContract,
      },
      files: {
        requestUpload: requestUploadContract,
        getUploadUrl: getUploadUrlContract,
        finalizeUpload: finalizeUploadContract,
        getDownloadUrl: getDownloadUrlContract,
        getDownloadUrls: getDownloadUrlsContract,
        requestSigningUpload: requestSigningUploadContract,
        getSigningUploadUrl: getSigningUploadUrlContract,
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
    expect(contractModules.companies).not.toHaveProperty("getSellerFacts");
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
    expect(contractRouter.documents.cancel).toBeDefined();
    expect(contractRouter.documents.createFromOrder).toBeDefined();
    expect(contractRouter.documents.get).toBeDefined();
    expect(contractRouter.documents.getShared).toBeDefined();
    expect(contractRouter.documents.list).toBeDefined();
    expect(contractRouter.documents.requestSign).toBeDefined();
    expect(contractRouter.documents.share).toBeDefined();
    expect(contractRouter.docSigning.get).toBeDefined();
    expect(contractRouter.docSigning.start).toBeDefined();
    expect(contractRouter.docSigning.complete).toBeDefined();
    expect(contractModules.docSigning.start.aiExposure).toBe("internal");
    expect(contractModules.docSigning.complete.aiExposure).toBe("internal");
    expect(contractModules.docSigning).not.toHaveProperty(
      "getSupplierSignedFlags",
    );
    expect(contractModules.docSigning).not.toHaveProperty("abandonRequest");
    expect(contractRouter.files.requestUpload).toBeDefined();
    expect(contractRouter.files.getUploadUrl).toBeDefined();
    expect(contractRouter.files.finalizeUpload).toBeDefined();
    expect(contractRouter.files.getDownloadUrl).toBeDefined();
    expect(contractRouter.files.getDownloadUrls).toBeDefined();
    expect(contractRouter.files.requestSigningUpload).toBeDefined();
    expect(contractRouter.files.getSigningUploadUrl).toBeDefined();
    expect(contractModules.files).not.toHaveProperty("getAttachmentFacts");
    expect(contractModules.files).not.toHaveProperty("sweepAbandonedUploads");
    expect(contractModules.files).not.toHaveProperty(
      "backfillCatalogRenditions",
    );
    expect(contractModules.files).not.toHaveProperty("recordGeneratedObject");
    expect(contractModules.files).not.toHaveProperty("recordSigningObject");
    expect(contractModules.files).not.toHaveProperty(
      "readPendingSigningObject",
    );
    expect(contractModules.files).not.toHaveProperty(
      "issueDocumentDownloadUrl",
    );
    expect(contractModules.files).not.toHaveProperty("issueShareDownloadUrl");
    expect(contractModules.files).not.toHaveProperty("issueSigningDownloadUrl");
    expect(contractModules.files).not.toHaveProperty(
      "issueShareSigningDownloadUrl",
    );
    expect(contractModules.files).not.toHaveProperty(
      "issueSystemSigningDownloadUrl",
    );
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
    expect(contractRouter.assistant.createConversation).toBeDefined();
    expect(contractRouter.assistant.listConversations).toBeDefined();
    expect(contractRouter.assistant.getConversation).toBeDefined();
    expect(contractRouter.assistant.appendUserMessage).toBeDefined();
    expect(contractModules.assistant).not.toHaveProperty("recordAssistantTurn");
    expect(contractModules.assistant).not.toHaveProperty("getStaffActor");
  });

  it("keeps assistant persistence actions off the AI tool manifest", () => {
    const contracts = Object.values(contractModules).flatMap((module) =>
      Object.values(module),
    );
    expect(
      deriveAiToolSources(contracts)
        .map((contract) => contract.name)
        .filter((name) => name.startsWith("assistant.")),
    ).toEqual([]);
  });
});
