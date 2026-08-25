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
  getProductOrderFacts,
  getProductPricingFacts,
  restoreProduct,
  restoreVariant,
  updateProduct,
} from "@showzy/catalog";
import { catalogSuiteCoverage } from "@showzy/catalog/suite-coverage";
import {
  getOrderCard,
  orderCardUpdaterSubscriptions,
  upsertOrderCard,
} from "@showzy/chat";
import { chatSuiteCoverage } from "@showzy/chat/suite-coverage";
import { createCompany, listMine } from "@showzy/companies";
import { companiesSuiteCoverage } from "@showzy/companies/suite-coverage";
import { getCustomerPricingFacts } from "@showzy/customers";
import { customersSuiteCoverage } from "@showzy/customers/suite-coverage";
import {
  finalizeUpload,
  getAttachmentFacts,
  getDownloadUrl,
  getUploadUrl,
  requestUpload,
  sweepAbandonedUploads,
} from "@showzy/files";
import { filesSuiteCoverage } from "@showzy/files/suite-coverage";
import {
  confirmOrder,
  createOrder,
  getOrder,
  ordersConfirmed,
  ordersCreated,
} from "@showzy/orders";
import { ordersSuiteCoverage } from "@showzy/orders/suite-coverage";
import { resolveProductPrices } from "@showzy/pricing";
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
  filesSuiteCoverage,
  ordersSuiteCoverage,
  pricingSuiteCoverage,
];

const events: readonly EventDefinitionRef[] = [ordersCreated, ordersConfirmed];

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
    caller: "pricing.resolveProductPrices",
    callee: "catalog.getProductPricingFacts",
  },
  {
    caller: "pricing.resolveProductPrices",
    callee: "customers.getCustomerPricingFacts",
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
  { importer: "files", schemaOwner: "files" },
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
  registerAction(registry, getProductOrderFacts);
  registerAction(registry, getProductPricingFacts);
  registerAction(registry, createProduct);
  registerAction(registry, updateProduct);
  registerAction(registry, archiveProduct);
  registerAction(registry, restoreProduct);
  registerAction(registry, archiveVariant);
  registerAction(registry, restoreVariant);
  registerAction(registry, getOrderCard);
  registerAction(registry, upsertOrderCard);
  registerAction(registry, createCompany);
  registerAction(registry, listMine);
  registerAction(registry, getCustomerPricingFacts);
  registerAction(registry, requestUpload);
  registerAction(registry, getUploadUrl);
  registerAction(registry, finalizeUpload);
  registerAction(registry, getDownloadUrl);
  registerAction(registry, getAttachmentFacts);
  registerAction(registry, sweepAbandonedUploads);
  registerAction(registry, createOrder);
  registerAction(registry, confirmOrder);
  registerAction(registry, getOrder);
  registerAction(registry, resolveProductPrices);
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
    subscriptions: eventSubscriptionRefs([...orderCardUpdaterSubscriptions]),
    callEdges,
    projectionGrants,
    readModelGrants,
    schemaImports,
    suiteCoverage: mergeSuiteCoverage(moduleSuiteCoverage),
  };
}
