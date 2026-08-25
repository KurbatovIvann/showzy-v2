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
  createProductContract,
  createVariantContract,
  getProductContract,
  listProductsContract,
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
  getUploadUrlContract,
  requestUploadContract,
} from "@showzy/files/contract";
import {
  confirmOrderContract,
  createOrderContract,
  getOrderContract,
} from "@showzy/orders/contract";
import { resolveProductPricesContract } from "@showzy/pricing/contract";

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
  },
  orders: {
    create: createOrderContract,
    confirm: confirmOrderContract,
    get: getOrderContract,
  },
  pricing: {
    resolveProductPrices: resolveProductPricesContract,
  },
} satisfies ContractModuleMap;

/**
 * The oRPC contract router — what the typed client and the OpenAPI
 * document (fnd-T25) consume.
 */
export const contractRouter = buildContractRouter(contractModules);
