/**
 * The process composition root (fnd-G1 A2): the boot ActionRegistry and
 * the CI contract-check input are assembled here so they cannot diverge.
 *
 * Module tasks register in this file — never in `packages/core`. Each
 * module exports actions from `index.ts`, client descriptors from
 * `index.contract.ts` (added to `packages/contract` `contractModules`),
 * and a `suiteCoverage` declaration next to those barrels (exported from
 * the module's `./suite-coverage` subpath — `index.ts` exports only
 * actions and events). This root registers both barrels, concatenates
 * events/subscriptions/call edges/schema-ownership rows, and merges
 * coverage.
 *
 * Worker delivery bindings stay in `apps/worker/src/subscriptions.ts`
 * and must list the same `defineEventHandler` objects this file passes
 * through `eventSubscriptionRefs`.
 */
import {
  archiveProduct,
  archiveVariant,
  createProduct,
  createVariant,
  getProduct,
  getProductOrderFacts,
  getProductPricingFacts,
  listProducts,
  restoreProduct,
  restoreVariant,
  setProductImages,
  updateProduct,
  updateVariant,
} from "@showzy/catalog";
import { catalogSuiteCoverage } from "@showzy/catalog/suite-coverage";
import {
  getOrderCard,
  orderCardUpdaterSubscriptions,
  upsertOrderCard,
} from "@showzy/chat";
import { chatSuiteCoverage } from "@showzy/chat/suite-coverage";
import {
  createCompany,
  getCompany,
  getSellerFacts,
  listMine,
  updateLegal,
} from "@showzy/companies";
import { companiesSuiteCoverage } from "@showzy/companies/suite-coverage";
import {
  applyInviteCrm,
  archiveCustomer,
  createCounterparty,
  createCustomer,
  createGroup,
  deleteCounterparty,
  deleteCustomer,
  deleteGroup,
  getCounterparty,
  getCustomer,
  getCustomerPricingFacts,
  getGroup,
  listCounterparties,
  listCustomers,
  listGroups,
  restoreCustomer,
  updateCounterparty,
  updateCustomer,
  updateGroup,
} from "@showzy/customers";
import { customersSuiteCoverage } from "@showzy/customers/suite-coverage";
import {
  cancelDocument,
  createFromOrder,
  documentsCancelled,
  documentsCreated,
  getDocument,
  getForGeneration,
  getShared,
  listDocuments,
  shareDocument,
} from "@showzy/documents";
import { documentsSuiteCoverage } from "@showzy/documents/suite-coverage";
import {
  getArtifact,
  pdfRendererSubscriptions,
  renderPdf,
} from "@showzy/doc-generation";
import { docGenerationSuiteCoverage } from "@showzy/doc-generation/suite-coverage";
import {
  finalizeUpload,
  getAttachmentFacts,
  getDownloadUrl,
  getDownloadUrls,
  getUploadUrl,
  issueDocumentDownloadUrl,
  issueShareDownloadUrl,
  recordGeneratedObject,
  requestUpload,
  sweepAbandonedUploads,
} from "@showzy/files";
import { filesSuiteCoverage } from "@showzy/files/suite-coverage";
import {
  acceptInvite,
  createInvite,
  getInvite,
  invitesAccepted,
  invitesCreated,
  invitesRevoked,
  listInvites,
  revokeInvite,
} from "@showzy/invites";
import { invitesSuiteCoverage } from "@showzy/invites/suite-coverage";
import {
  cancelOrder,
  confirmOrder,
  createOrder,
  getOrder,
  listOrders,
  ordersCanceled,
  ordersConfirmed,
  ordersCreated,
} from "@showzy/orders";
import { ordersSuiteCoverage } from "@showzy/orders/suite-coverage";
import {
  activatePriceList,
  createPriceList,
  deactivatePriceList,
  deletePriceList,
  getPriceList,
  listPriceListEntries,
  listPriceLists,
  removePriceListEntries,
  resolveProductPrices,
  setDefaultPriceList,
  setPriceListEntries,
  updatePriceList,
} from "@showzy/pricing";
import { pricingSuiteCoverage } from "@showzy/pricing/suite-coverage";
import {
  ActionRegistry,
  emptySuiteCoverage,
  eventSubscriptionRefs,
  type ContractCheckInput,
  type DeclaredCallEdge,
  type EventDefinitionRef,
  type ImplementedAction,
  type ReadModelGrantRef,
  type SchemaImportRef,
  type SuiteCoverageManifest,
} from "@showzy/core";
import { projectionGrants } from "@showzy/db";
import type { z } from "zod";

/**
 * Per-module inherited-suite declarations (core.md §12). Module tasks
 * append the export that lives next to that module's barrels
 * (`@showzy/<module>/suite-coverage`).
 */
const moduleSuiteCoverage: readonly SuiteCoverageManifest[] = [
  catalogSuiteCoverage,
  chatSuiteCoverage,
  companiesSuiteCoverage,
  customersSuiteCoverage,
  documentsSuiteCoverage,
  docGenerationSuiteCoverage,
  filesSuiteCoverage,
  invitesSuiteCoverage,
  ordersSuiteCoverage,
  pricingSuiteCoverage,
];

const events: readonly EventDefinitionRef[] = [
  ordersCreated,
  ordersConfirmed,
  ordersCanceled,
  documentsCancelled,
  documentsCreated,
  invitesAccepted,
  invitesCreated,
  invitesRevoked,
];

const callEdges: readonly DeclaredCallEdge[] = [
  {
    caller: "orders.create",
    callee: "catalog.getProductOrderFacts",
  },
  {
    caller: "orders.create",
    callee: "pricing.resolveProductPrices",
  },
  {
    caller: "orders.list",
    callee: "customers.listCustomers",
  },
  {
    caller: "pricing.resolveProductPrices",
    callee: "catalog.getProductPricingFacts",
  },
  {
    caller: "pricing.setPriceListEntries",
    callee: "catalog.getProductPricingFacts",
  },
  {
    caller: "pricing.resolveProductPrices",
    callee: "customers.getCustomerPricingFacts",
  },
  {
    caller: "catalog.setProductImages",
    callee: "files.getAttachmentFacts",
  },
  {
    caller: "customers.createCustomer",
    callee: "pricing.listPriceLists",
  },
  {
    caller: "customers.createGroup",
    callee: "pricing.listPriceLists",
  },
  {
    caller: "customers.updateCustomer",
    callee: "pricing.listPriceLists",
  },
  {
    caller: "customers.updateGroup",
    callee: "pricing.listPriceLists",
  },
  {
    caller: "invites.create",
    callee: "customers.getGroup",
  },
  {
    caller: "invites.create",
    callee: "pricing.getPriceList",
  },
  {
    caller: "documents.createFromOrder",
    callee: "orders.get",
  },
  {
    caller: "documents.createFromOrder",
    callee: "companies.getSellerFacts",
  },
  {
    caller: "documents.createFromOrder",
    callee: "customers.getCounterparty",
  },
  {
    caller: "documents.createFromOrder",
    callee: "customers.getCustomer",
  },
  {
    caller: "documents.share",
    callee: "docGeneration.getArtifact",
  },
  {
    caller: "documents.share",
    callee: "files.issueShareDownloadUrl",
  },
  {
    caller: "documents.get",
    callee: "docGeneration.getArtifact",
  },
  {
    caller: "documents.get",
    callee: "files.issueDocumentDownloadUrl",
  },
  {
    caller: "docGeneration.renderPdf",
    callee: "documents.getForGeneration",
  },
];

const readModelGrants: readonly ReadModelGrantRef[] = [
  // Projection owners record spec-declared grants here (ADR-0015).
];

const schemaImports: readonly SchemaImportRef[] = [
  { importer: "catalog", schemaOwner: "catalog" },
  { importer: "chat", schemaOwner: "chat" },
  { importer: "companies", schemaOwner: "companies" },
  { importer: "customers", schemaOwner: "customers" },
  { importer: "documents", schemaOwner: "documents" },
  { importer: "doc-generation", schemaOwner: "doc-generation" },
  { importer: "files", schemaOwner: "files" },
  { importer: "invites", schemaOwner: "invites" },
  { importer: "orders", schemaOwner: "orders" },
  { importer: "pricing", schemaOwner: "pricing" },
];

/** Registers one implemented action's contract + implementation pair. */
export function registerAction<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TTarget,
>(
  registry: ActionRegistry,
  action: ImplementedAction<TInput, TOutput, TTarget>,
): void {
  registry.registerContract(action.contract);
  registry.registerImplementation(action);
}

export function mergeSuiteCoverage(
  manifests: readonly SuiteCoverageManifest[],
): SuiteCoverageManifest {
  if (manifests.length === 0) {
    return emptySuiteCoverage;
  }
  return {
    isolation: manifests.flatMap((manifest) => manifest.isolation),
    publicProjection: manifests.flatMap(
      (manifest) => manifest.publicProjection,
    ),
    consumerIsolation: manifests.flatMap(
      (manifest) => manifest.consumerIsolation,
    ),
    accountIsolation: manifests.flatMap(
      (manifest) => manifest.accountIsolation,
    ),
    shareIsolation: manifests.flatMap((manifest) => manifest.shareIsolation),
    idempotency: manifests.flatMap((manifest) => manifest.idempotency),
    events: manifests.flatMap((manifest) => manifest.events),
    atomic: manifests.flatMap((manifest) => manifest.atomic),
  };
}

/** The boot registry — same builder the contract-check stage walks. */
export function createActionRegistry(): ActionRegistry {
  const registry = new ActionRegistry();
  registerAction(registry, createProduct);
  registerAction(registry, createVariant);
  registerAction(registry, getProduct);
  registerAction(registry, getProductOrderFacts);
  registerAction(registry, getProductPricingFacts);
  registerAction(registry, listProducts);
  registerAction(registry, updateProduct);
  registerAction(registry, updateVariant);
  registerAction(registry, archiveProduct);
  registerAction(registry, restoreProduct);
  registerAction(registry, archiveVariant);
  registerAction(registry, restoreVariant);
  registerAction(registry, setProductImages);
  registerAction(registry, getOrderCard);
  registerAction(registry, upsertOrderCard);
  registerAction(registry, createCompany);
  registerAction(registry, getCompany);
  registerAction(registry, getSellerFacts);
  registerAction(registry, listMine);
  registerAction(registry, updateLegal);
  registerAction(registry, applyInviteCrm);
  registerAction(registry, archiveCustomer);
  registerAction(registry, createCounterparty);
  registerAction(registry, createCustomer);
  registerAction(registry, createGroup);
  registerAction(registry, deleteCounterparty);
  registerAction(registry, deleteCustomer);
  registerAction(registry, deleteGroup);
  registerAction(registry, getCounterparty);
  registerAction(registry, getCustomer);
  registerAction(registry, getCustomerPricingFacts);
  registerAction(registry, getGroup);
  registerAction(registry, listCounterparties);
  registerAction(registry, listCustomers);
  registerAction(registry, listGroups);
  registerAction(registry, restoreCustomer);
  registerAction(registry, updateCounterparty);
  registerAction(registry, updateCustomer);
  registerAction(registry, updateGroup);
  registerAction(registry, requestUpload);
  registerAction(registry, getUploadUrl);
  registerAction(registry, finalizeUpload);
  registerAction(registry, getDownloadUrl);
  registerAction(registry, getDownloadUrls);
  registerAction(registry, getAttachmentFacts);
  registerAction(registry, issueDocumentDownloadUrl);
  registerAction(registry, issueShareDownloadUrl);
  registerAction(registry, recordGeneratedObject);
  registerAction(registry, sweepAbandonedUploads);
  registerAction(registry, acceptInvite);
  registerAction(registry, createInvite);
  registerAction(registry, getInvite);
  registerAction(registry, listInvites);
  registerAction(registry, revokeInvite);
  registerAction(registry, cancelDocument);
  registerAction(registry, createFromOrder);
  registerAction(registry, getDocument);
  registerAction(registry, getForGeneration);
  registerAction(registry, getShared);
  registerAction(registry, listDocuments);
  registerAction(registry, shareDocument);
  registerAction(registry, getArtifact);
  registerAction(registry, renderPdf);
  registerAction(registry, createOrder);
  registerAction(registry, confirmOrder);
  registerAction(registry, cancelOrder);
  registerAction(registry, getOrder);
  registerAction(registry, listOrders);
  registerAction(registry, activatePriceList);
  registerAction(registry, createPriceList);
  registerAction(registry, deactivatePriceList);
  registerAction(registry, deletePriceList);
  registerAction(registry, getPriceList);
  registerAction(registry, listPriceListEntries);
  registerAction(registry, listPriceLists);
  registerAction(registry, removePriceListEntries);
  registerAction(registry, resolveProductPrices);
  registerAction(registry, setDefaultPriceList);
  registerAction(registry, setPriceListEntries);
  registerAction(registry, updatePriceList);
  return registry;
}

/**
 * Everything `runContractCheck` walks. Empty collections are explicit
 * statements that nothing of that kind exists yet.
 */
export function buildContractCheckInput(): ContractCheckInput {
  return {
    registry: createActionRegistry(),
    events,
    subscriptions: eventSubscriptionRefs([
      ...orderCardUpdaterSubscriptions,
      ...pdfRendererSubscriptions,
    ]),
    callEdges,
    projectionGrants,
    readModelGrants,
    schemaImports,
    suiteCoverage: mergeSuiteCoverage(moduleSuiteCoverage),
  };
}
