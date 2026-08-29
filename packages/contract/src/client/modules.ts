/**
 * The client-exposure composition record (contract.md §2, layer 2).
 *
 * `packages/contract` imports **only** module `index.contract.ts` barrels;
 * each module task adds its client-routable descriptors here, keyed
 * `<module>.<verb>` exactly like the descriptor names. Internal facts
 * actions stay off this record — only `transport: "client"` descriptors
 * are routable.
 *
 * The server-router builder (./server) proves in both directions that
 * this record matches the boot registry: a registered client action
 * missing here, or an entry here that is not registered, fails boot.
 */
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

import {
  buildContractRouter,
  type ContractModuleMap,
} from "./contract-router.js";

export const contractModules = {
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
} satisfies ContractModuleMap;

/**
 * The oRPC contract router — what the typed client and the OpenAPI
 * document (fnd-T25) consume.
 */
export const contractRouter = buildContractRouter(contractModules);
