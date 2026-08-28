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
  createGroupContract,
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
  confirmOrderContract,
  createOrderContract,
  getOrderContract,
} from "@showzy/orders/contract";
import {
  listPriceListsContract,
  resolveProductPricesContract,
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
    createGroup: createGroupContract,
    updateGroup: updateGroupContract,
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
    listPriceLists: listPriceListsContract,
    resolveProductPrices: resolveProductPricesContract,
  },
} satisfies ContractModuleMap;

/**
 * The oRPC contract router — what the typed client and the OpenAPI
 * document (fnd-T25) consume.
 */
export const contractRouter = buildContractRouter(contractModules);
