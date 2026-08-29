import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineActionContract } from "@showzy/core/contract";
import { implementAction } from "@showzy/core";
import {
  ConflictError,
  CoreInvariantError,
  PermissionDeniedError,
} from "@showzy/core/errors";
import {
  atomicCallSuite,
  createTestKit,
  crossTenantSuite,
  eventSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { user } from "@showzy/db/schema/auth";
import { products } from "@showzy/db/schema/catalog";
import { companyLegalInfo, companyMembers } from "@showzy/db/schema/companies";
import { companyCustomers } from "@showzy/db/schema/customers";
import { documentGenerationJobs } from "@showzy/db/schema/doc-generation";
import {
  documentItems,
  documents,
  documentShareTokens,
} from "@showzy/db/schema/documents";
import { files } from "@showzy/db/schema/files";
import { orderItems, orders } from "@showzy/db/schema/orders";
import {
  createFromOrder,
  documentsCreated,
  getDocument,
  shareDocument,
} from "@showzy/documents";
import { configureDocumentShareOrigin } from "@showzy/documents/share-origin";
import { recordGeneratedObject } from "@showzy/files";
import {
  closeFilesObjectStore,
  configureFilesObjectStore,
  getFilesObjectStore,
} from "@showzy/files/storage";
import { and, count, eq, isNull } from "drizzle-orm";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getArtifact } from "./get-artifact.js";
import { renderPdf } from "./render-pdf.js";
import type { renderPdfInputSchema } from "./render-pdf.contract.js";
import { pdfRendererCreated } from "../events/pdf-renderer.js";
import { artifactFileId } from "../services/artifact-file-id.js";
import { sha256Hex } from "../services/checksum.js";
import { putGeneratedPdf } from "../services/put-generated-pdf.js";
import { requireWritable } from "../services/writable.js";

const GARAGE_IMAGE = "dxflrs/garage:v2.3.0";
const GARAGE_BUCKET = "showzy";
const GARAGE_ACCESS_KEY = "showzy-local";
const GARAGE_SECRET_KEY = "showzy-local-secret";
const TEST_ORIGIN = "https://documents.test";
const sampleIban = "UA123456789012345678901234567";
const dummyPdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
const dummyChecksum = sha256Hex(dummyPdf);

type CreatedEnvelope = z.input<typeof renderPdfInputSchema>;

const fixtures = {
  customerA: randomUUID(),
  customerB: randomUUID(),
  productA: randomUUID(),
  productB: randomUUID(),
  orderEvent: randomUUID(),
  itemEvent: randomUUID(),
  isolationA: randomUUID(),
  isolationB: randomUUID(),
  invoice: randomUUID(),
  note: randomUUID(),
  fail: randomUUID(),
  pendingShare: randomUUID(),
  atomicFail: randomUUID(),
  atomicOk: randomUUID(),
};

const clerks = {
  employee: randomUUID(),
  noView: randomUUID(),
};

const sellerSnapshot = {
  kind: "seller" as const,
  name: "Konditerska Anna",
  prefix: "KA",
  companyType: "tov" as const,
  legalName: "ТОВ Альфа",
  edrpou: "12345678",
  legalAddress: "вул. Хрещатик, 1",
  iban: sampleIban,
  bankName: "ПриватБанк",
  bankMfo: "300001",
  bankEdrpou: "12345678",
  phone: "+380501111111",
  email: "legal@alpha.test",
};

const customerBuyerSnapshot = {
  kind: "customer" as const,
  displayName: "Customer A",
};

const counterpartyBuyerSnapshot = {
  kind: "counterparty" as const,
  name: "ТОВ Покупець",
  edrpou: "11223344",
  legalAddress: "вул. Покупця, 2",
  iban: "UA111111111111111111111111111",
  bankName: "Ощадбанк",
  bankMfo: "300335",
  phone: "+380502222222",
  email: "buyer@example.com",
  notes: "Linked buyer",
};

const contractDefaults = {
  aiExposure: "internal" as const,
  requiresConfirmation: false,
  atomicCalls: [] as const,
  atomicCallers: [] as const,
};

const emitCreatedThenFail = implementAction(
  defineActionContract({
    name: "documents.emitCreatedThenFailPdf",
    description:
      "Test-local emitter that fails after buffering documents.created.",
    principal: "staff",
    transport: "internal",
    input: z.object({ documentId: z.uuid() }),
    output: z.object({ documentId: z.uuid() }),
    permissions: ["documents:create"],
    aiExposure: "internal",
    risk: "write",
    requiresConfirmation: false,
    idempotent: true,
    emits: ["documents.created"],
    atomicCalls: [],
    atomicCallers: [],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: (input, ctx) => {
      if (ctx.principal !== "staff") {
        throw new CoreInvariantError("emitCreatedThenFail expects staff");
      }
      ctx.emit(documentsCreated, {
        aggregate: { type: "document", id: input.documentId },
        payload: {
          documentId: input.documentId,
          orderId: fixtures.orderEvent,
          type: "payment_invoice",
          documentNumber: "KA-РХ-000000",
        },
      });
      throw new ConflictError("Injected emit-then-fail.");
    },
    auditTarget: (env) => {
      const parsed = z.object({ documentId: z.string() }).safeParse(env.input);
      return {
        type: "document",
        id: parsed.success ? parsed.data.documentId : "unknown",
      };
    },
  },
);

const recordThenMaybeFail = implementAction(
  defineActionContract({
    name: "docGeneration.renderPdf",
    description:
      "Test-local renderPdf twin that can fail after recording the PDF.",
    principal: "system",
    systemScope: "tenant",
    transport: "internal",
    input: z.object({
      fileId: z.uuid(),
      purpose: z.literal("document"),
      mimeType: z.literal("application/pdf"),
      byteSize: z.number().int().positive(),
      checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
      documentId: z.uuid(),
      failAfterCall: z.boolean(),
    }),
    output: z.object({
      status: z.literal("ready"),
      fileId: z.uuid(),
      documentId: z.uuid(),
    }),
    permissions: [],
    aiExposure: "internal",
    risk: "write",
    requiresConfirmation: false,
    idempotent: true,
    emits: [],
    atomicCalls: ["files.recordGeneratedObject"],
    atomicCallers: [],
    audit: true,
    timeout: 15_000,
  }),
  {
    handler: async (input, ctx) => {
      if (ctx.principal !== "system" || ctx.scope !== "tenant") {
        throw new CoreInvariantError(
          "docGeneration.renderPdf twin expects tenant system",
        );
      }
      const recorded = await ctx.callAtomic(recordGeneratedObject, {
        fileId: input.fileId,
        purpose: input.purpose,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        checksumSha256: input.checksumSha256,
      });
      if (input.failAfterCall) {
        throw new ConflictError("Root failed after the atomic call.");
      }
      const db = requireWritable(ctx.db);
      await db.insert(documentGenerationJobs).values({
        companyId: ctx.companyId,
        documentId: input.documentId,
        status: "ready",
        fileId: recorded.fileId,
      });
      return {
        status: "ready" as const,
        fileId: recorded.fileId,
        documentId: input.documentId,
      };
    },
    auditTarget: () => ({ type: "document", id: "render-pdf-atomic-twin" }),
  },
);

const undeclaredTouch = implementAction(
  defineActionContract({
    ...contractDefaults,
    name: "kitCatalog.undeclaredTouch",
    description: "Write callee that is not on any atomic edge.",
    principal: "staff",
    transport: "internal",
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    permissions: ["kitCatalog:manageStock"],
    risk: "write",
    idempotent: false,
    emits: [],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: () => Promise.resolve({ ok: true }),
    auditTarget: () => ({ type: "stock", id: "undeclared" }),
  },
);

const confirmUndeclared = implementAction(
  defineActionContract({
    ...contractDefaults,
    name: "kitOrders.confirmUndeclared",
    description: "Root whose handler calls an undeclared atomic callee.",
    principal: "staff",
    transport: "client",
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    permissions: ["kitOrders:confirm"],
    risk: "write",
    idempotent: true,
    emits: [],
    atomicCalls: ["customers.applyInviteCrm"],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: async (_input, ctx) => {
      await ctx.callAtomic(undeclaredTouch, {});
      return { ok: true };
    },
    auditTarget: () => ({ type: "order", id: "undeclared" }),
  },
);

const mismatchStock = implementAction(
  defineActionContract({
    ...contractDefaults,
    name: "kitCatalog.mismatchStock",
    description: "Staff callee declared for a system atomic root (bug).",
    principal: "staff",
    transport: "internal",
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    permissions: ["kitCatalog:manageStock"],
    risk: "write",
    idempotent: false,
    emits: [],
    atomicCallers: ["kitOrders.confirmMismatch"],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: () => Promise.resolve({ ok: true }),
    auditTarget: () => ({ type: "stock", id: "mismatch" }),
  },
);

const confirmMismatch = implementAction(
  defineActionContract({
    ...contractDefaults,
    name: "kitOrders.confirmMismatch",
    description: "System root reaching a staff atomic callee (a bug).",
    principal: "system",
    systemScope: "tenant",
    transport: "internal",
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    permissions: [],
    risk: "write",
    idempotent: true,
    emits: [],
    atomicCalls: ["kitCatalog.mismatchStock"],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: async (_input, ctx) => {
      await ctx.callAtomic(mismatchStock, {});
      return { ok: true };
    },
    auditTarget: () => ({ type: "order", id: "mismatch" }),
  },
);

const nestedCallee = implementAction(
  defineActionContract({
    ...contractDefaults,
    name: "kitCatalog.nestedStock",
    description: "Declared callee that illegally nests another atomic call.",
    principal: "staff",
    transport: "internal",
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    permissions: ["kitCatalog:manageStock"],
    risk: "write",
    idempotent: false,
    emits: [],
    atomicCallers: ["kitOrders.confirmNested"],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: async (_input, ctx) => {
      await ctx.callAtomic(undeclaredTouch, {});
      return { ok: true };
    },
    auditTarget: () => ({ type: "stock", id: "nested" }),
  },
);

const confirmNested = implementAction(
  defineActionContract({
    ...contractDefaults,
    name: "kitOrders.confirmNested",
    description: "Root of a declared edge whose callee nests atomically.",
    principal: "staff",
    transport: "client",
    input: z.object({}),
    output: z.object({ ok: z.boolean() }),
    permissions: ["kitOrders:confirm"],
    risk: "write",
    idempotent: true,
    emits: [],
    atomicCalls: ["kitCatalog.nestedStock"],
    audit: true,
    timeout: 5_000,
  }),
  {
    handler: async (_input, ctx) => {
      await ctx.callAtomic(nestedCallee, {});
      return { ok: true };
    },
    auditTarget: () => ({ type: "order", id: "nested" }),
  },
);

let kit: TestKit | undefined;
let garage: StartedTestContainer | undefined;
let garageEndpoint: string | undefined;
const seedOrderNumbers = new Map<string, number>();

function requireKit(): TestKit {
  if (kit === undefined) {
    throw new Error("doc-generation test kit was not started");
  }
  return kit;
}

function repoRoot(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error("repository root not found");
    }
    directory = parent;
  }
  return directory;
}

function garageS3Config(): {
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
  readonly bucket: string;
} {
  if (garageEndpoint === undefined) {
    throw new Error("garage endpoint is not configured");
  }
  return {
    endpoint: garageEndpoint,
    region: "us-east-1",
    accessKeyId: GARAGE_ACCESS_KEY,
    secretAccessKey: GARAGE_SECRET_KEY,
    forcePathStyle: true,
    bucket: GARAGE_BUCKET,
  };
}

async function waitForBucket(): Promise<void> {
  const store = getFilesObjectStore();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await store.probeBucket();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Garage bucket did not become ready");
}

function nextSeedOrderNumber(companyId: string): number {
  const next = (seedOrderNumbers.get(companyId) ?? 0) + 1;
  seedOrderNumbers.set(companyId, next);
  return next;
}

async function insertSeedOrder(values: {
  id: string;
  itemId: string;
  companyId: string;
  customerId: string;
  productId: string;
}): Promise<void> {
  const unit = 250n;
  await requireKit()
    .db.runtime.db.insert(orders)
    .values({
      id: values.id,
      companyId: values.companyId,
      orderNumber: nextSeedOrderNumber(values.companyId),
      customerId: values.customerId,
      status: "new",
      totalNetMinor: unit,
      totalTaxMinor: 0n,
      totalGrossMinor: unit,
      currency: "UAH",
    });
  await requireKit().db.runtime.db.insert(orderItems).values({
    id: values.itemId,
    companyId: values.companyId,
    orderId: values.id,
    productId: values.productId,
    titleSnapshot: "Seed line",
    quantityMilli: 1000n,
    unitPriceMinor: unit,
    taxTreatment: "exempt",
    netAmountMinor: unit,
    grossAmountMinor: unit,
    priceSource: "base",
    resolverVersion: 1,
  });
}

async function insertSeedDocument(values: {
  id: string;
  companyId: string;
  customerId: string;
  productId: string;
  documentNumber: string;
  type?: "payment_invoice" | "delivery_note";
  buyer?: typeof customerBuyerSnapshot | typeof counterpartyBuyerSnapshot;
}): Promise<void> {
  const orderId = randomUUID();
  const orderItemId = randomUUID();
  const itemId = randomUUID();
  const type = values.type ?? "payment_invoice";
  await insertSeedOrder({
    id: orderId,
    itemId: orderItemId,
    companyId: values.companyId,
    customerId: values.customerId,
    productId: values.productId,
  });
  await requireKit()
    .db.runtime.db.insert(documents)
    .values({
      id: values.id,
      companyId: values.companyId,
      orderId,
      counterpartyId: null,
      type,
      status: "issued",
      documentNumber: values.documentNumber,
      issuedOn: "2026-03-15",
      supplierDetails: sellerSnapshot,
      buyerDetails: values.buyer ?? customerBuyerSnapshot,
      totalNetMinor: 250n,
      totalTaxMinor: 0n,
      totalGrossMinor: 250n,
      currency: "UAH",
      templateSource: "system",
      templateName: type,
    });
  await requireKit().db.runtime.db.insert(documentItems).values({
    id: itemId,
    companyId: values.companyId,
    documentId: values.id,
    productId: values.productId,
    titleSnapshot: "Invoice line",
    quantityMilli: 1000n,
    unitPriceMinor: 250n,
    taxTreatment: "exempt",
    netAmountMinor: 250n,
    grossAmountMinor: 250n,
    currency: "UAH",
  });
}

function createdEnvelope(values: {
  readonly documentId: string;
  readonly type: "payment_invoice" | "delivery_note";
  readonly documentNumber: string;
}): CreatedEnvelope {
  const eventId = randomUUID();
  return {
    eventId,
    name: "documents.created",
    version: 1,
    occurredAt: new Date().toISOString(),
    companyId: kitIdentities.companies.a,
    aggregate: { type: "document", id: values.documentId, sequence: "1" },
    actor: { type: "user", id: kitIdentities.users.anna, channel: "ui" },
    requestId: randomUUID(),
    correlationId: randomUUID(),
    causationId: eventId,
    payload: {
      documentId: values.documentId,
      orderId: fixtures.orderEvent,
      type: values.type,
      documentNumber: values.documentNumber,
    },
  };
}

async function countReadyJobs(): Promise<number> {
  const rows = await requireKit()
    .db.runtime.db.select({ value: count() })
    .from(documentGenerationJobs)
    .where(
      and(
        eq(documentGenerationJobs.companyId, kitIdentities.companies.a),
        eq(documentGenerationJobs.status, "ready"),
      ),
    );
  return rows[0]?.value ?? 0;
}

async function countDocumentFiles(): Promise<number> {
  const rows = await requireKit()
    .db.runtime.db.select({ value: count() })
    .from(files)
    .where(
      and(
        eq(files.companyId, kitIdentities.companies.a),
        eq(files.purpose, "document"),
      ),
    );
  return rows[0]?.value ?? 0;
}

function recordInput(documentId: string): {
  readonly fileId: string;
  readonly purpose: "document";
  readonly mimeType: "application/pdf";
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly documentId: string;
  readonly failAfterCall: boolean;
} {
  return {
    fileId: artifactFileId(documentId),
    purpose: "document",
    mimeType: "application/pdf",
    byteSize: dummyPdf.byteLength,
    checksumSha256: dummyChecksum,
    documentId,
    failAfterCall: false,
  };
}

beforeAll(async () => {
  const garageToml = readFileSync(
    path.join(repoRoot(), "docker/garage/garage.toml"),
    "utf8",
  ).replaceAll("\r\n", "\n");
  const startedGarage = await new GenericContainer(GARAGE_IMAGE)
    .withCommand(["/garage", "server", "--single-node", "--default-bucket"])
    .withEnvironment({
      GARAGE_ALLOW_WORLD_READABLE_SECRETS: "true",
      GARAGE_DEFAULT_ACCESS_KEY: GARAGE_ACCESS_KEY,
      GARAGE_DEFAULT_SECRET_KEY: GARAGE_SECRET_KEY,
      GARAGE_DEFAULT_BUCKET: GARAGE_BUCKET,
    })
    .withCopyContentToContainer([
      {
        content: garageToml,
        target: "/etc/garage.toml",
      },
    ])
    .withTmpFs({
      "/var/lib/garage/meta": "rw,noexec,nosuid,size=64m",
      "/var/lib/garage/data": "rw,noexec,nosuid,size=256m",
    })
    .withExposedPorts(3900)
    .withWaitStrategy(Wait.forLogMessage(/S3 API server listening/))
    .withStartupTimeout(120_000)
    .start();
  garage = startedGarage;
  garageEndpoint = `http://127.0.0.1:${String(startedGarage.getMappedPort(3900))}`;
  configureFilesObjectStore(garageS3Config());
  await waitForBucket();

  configureDocumentShareOrigin(TEST_ORIGIN);
  kit = await createTestKit();
  const companyA = kitIdentities.companies.a;
  const companyB = kitIdentities.companies.b;

  await requireKit()
    .db.runtime.db.insert(companyLegalInfo)
    .values([
      {
        companyId: companyA,
        companyType: "tov",
        legalName: "ТОВ Альфа",
        edrpou: "12345678",
        legalAddress: "вул. Хрещатик, 1",
        iban: sampleIban,
        bankName: "ПриватБанк",
        bankMfo: "300001",
        bankEdrpou: "12345678",
        phone: "+380501111111",
        email: "legal@alpha.test",
      },
      {
        companyId: companyB,
        companyType: "fop",
        legalName: "ФОП Борис",
        edrpou: "87654321",
      },
    ]);

  await requireKit()
    .db.runtime.db.insert(companyCustomers)
    .values([
      {
        id: fixtures.customerA,
        companyId: companyA,
        name: "Customer A",
        email: `customer-${fixtures.customerA}@example.com`,
      },
      {
        id: fixtures.customerB,
        companyId: companyB,
        name: "Customer B",
        email: `customer-${fixtures.customerB}@example.com`,
      },
    ]);
  await requireKit()
    .db.runtime.db.insert(products)
    .values([
      {
        id: fixtures.productA,
        companyId: companyA,
        name: "Cake",
        basePriceMinor: 250n,
      },
      {
        id: fixtures.productB,
        companyId: companyB,
        name: "Foreign cake",
        basePriceMinor: 100n,
      },
    ]);

  await insertSeedOrder({
    id: fixtures.orderEvent,
    itemId: fixtures.itemEvent,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
  });
  await insertSeedDocument({
    id: fixtures.isolationA,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000901",
  });
  await insertSeedDocument({
    id: fixtures.isolationB,
    companyId: companyB,
    customerId: fixtures.customerB,
    productId: fixtures.productB,
    documentNumber: "MB-РХ-000901",
  });
  await insertSeedDocument({
    id: fixtures.invoice,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000902",
  });
  await insertSeedDocument({
    id: fixtures.note,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-ВН-000902",
    type: "delivery_note",
    buyer: counterpartyBuyerSnapshot,
  });
  await insertSeedDocument({
    id: fixtures.fail,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000903",
  });
  await insertSeedDocument({
    id: fixtures.pendingShare,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000906",
  });
  await insertSeedDocument({
    id: fixtures.atomicFail,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000904",
  });
  await insertSeedDocument({
    id: fixtures.atomicOk,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000905",
  });

  await putGeneratedPdf({
    companyId: companyA,
    fileId: artifactFileId(fixtures.atomicFail),
    bytes: dummyPdf,
  });
  await putGeneratedPdf({
    companyId: companyA,
    fileId: artifactFileId(fixtures.atomicOk),
    bytes: dummyPdf,
  });

  await requireKit()
    .db.runtime.db.insert(user)
    .values([
      {
        id: clerks.employee,
        name: "Employee view",
        email: "employee-view@doc-gen-kit.test",
      },
      {
        id: clerks.noView,
        name: "No documents view",
        email: "noview@doc-gen-kit.test",
      },
    ]);
  await requireKit()
    .db.runtime.db.insert(companyMembers)
    .values([
      {
        companyId: companyA,
        userId: clerks.employee,
        role: "employee",
        permissions: { granted: ["documents:view"], denied: [] },
      },
      {
        companyId: companyA,
        userId: clerks.noView,
        role: "employee",
        permissions: { granted: [], denied: ["documents:view"] },
      },
    ]);
}, 180_000);

afterAll(async () => {
  if (kit !== undefined) {
    await requireKit().db.close();
  }
  closeFilesObjectStore();
  if (garage !== undefined) {
    await garage.stop();
  }
});

crossTenantSuite(requireKit, [
  isolationCase(
    renderPdf,
    {
      input: createdEnvelope({
        documentId: fixtures.isolationA,
        type: "payment_invoice",
        documentNumber: "KA-РХ-000901",
      }),
    },
    {
      input: createdEnvelope({
        documentId: fixtures.isolationB,
        type: "payment_invoice",
        documentNumber: "MB-РХ-000901",
      }),
    },
  ),
]);

eventSuite(requireKit, {
  module: "docGeneration",
  emitAction: createFromOrder,
  emitInput: { orderId: fixtures.orderEvent, type: "payment_invoice" },
  failingEmitAction: emitCreatedThenFail,
  failingEmitInput: { documentId: randomUUID() },
  eventName: "documents.created",
  subscription: pdfRendererCreated,
  readProjection: countReadyJobs,
});

atomicCallSuite(requireKit, [
  {
    root: recordThenMaybeFail,
    successInput: recordInput(fixtures.atomicOk),
    failureInput: {
      ...recordInput(fixtures.atomicFail),
      failAfterCall: true,
    },
    readRootEffect: countReadyJobs,
    readCalleeEffect: countDocumentFiles,
    undeclared: { action: confirmUndeclared, input: {} },
    mismatch: { action: confirmMismatch, input: {} },
    nested: { action: confirmNested, input: {} },
  },
]);

describe("docGeneration.renderPdf garage", () => {
  it("renders invoice and delivery note to purpose=document files", async () => {
    const invoice = await requireKit().invoke(
      renderPdf,
      createdEnvelope({
        documentId: fixtures.invoice,
        type: "payment_invoice",
        documentNumber: "KA-РХ-000902",
      }),
    );
    const note = await requireKit().invoke(
      renderPdf,
      createdEnvelope({
        documentId: fixtures.note,
        type: "delivery_note",
        documentNumber: "KA-ВН-000902",
      }),
    );
    expect(invoice.status).toBe("ready");
    expect(note.status).toBe("ready");
    expect(invoice.fileId).toBe(artifactFileId(fixtures.invoice));
    expect(note.fileId).toBe(artifactFileId(fixtures.note));
    if (invoice.fileId === null || note.fileId === null) {
      throw new Error("expected ready file ids");
    }

    const [invoiceFile] = await requireKit()
      .db.runtime.db.select()
      .from(files)
      .where(eq(files.id, invoice.fileId));
    const [noteFile] = await requireKit()
      .db.runtime.db.select()
      .from(files)
      .where(eq(files.id, note.fileId));
    expect(invoiceFile?.purpose).toBe("document");
    expect(noteFile?.purpose).toBe("document");
    expect(invoiceFile?.mimeType).toBe("application/pdf");
    expect(invoiceFile?.uploadedByUserId).toBeNull();
    expect(invoiceFile?.objectKey).toBe(
      `${kitIdentities.companies.a}/documents/${invoice.fileId}`,
    );
    expect(noteFile?.objectKey).toBe(
      `${kitIdentities.companies.a}/documents/${note.fileId}`,
    );
  });

  it("retries the same document without a second files row", async () => {
    const first = await requireKit().invoke(
      renderPdf,
      createdEnvelope({
        documentId: fixtures.invoice,
        type: "payment_invoice",
        documentNumber: "KA-РХ-000902",
      }),
    );
    const second = await requireKit().invoke(
      renderPdf,
      createdEnvelope({
        documentId: fixtures.invoice,
        type: "payment_invoice",
        documentNumber: "KA-РХ-000902",
      }),
    );
    expect(first.fileId).toBe(second.fileId);
    if (first.fileId === null) {
      throw new Error("expected a ready file id");
    }
    const rows = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.id, first.fileId));
    expect(rows).toHaveLength(1);
  });

  it("issues a panel PDF URL for documents:view without files:view", async () => {
    const panel = await requireKit().invoke(
      getDocument,
      { documentId: fixtures.invoice },
      {
        userId: clerks.employee,
        companyId: kitIdentities.companies.a,
      },
    );
    expect(panel.generation.status).toBe("ready");
    expect(panel.generation.fileId).toBe(artifactFileId(fixtures.invoice));
    expect(panel.pdfDownloadUrl).toMatch(/^https?:\/\//);

    await expect(
      requireKit().invoke(
        getArtifact,
        { documentId: fixtures.invoice },
        {
          userId: clerks.noView,
          companyId: kitIdentities.companies.a,
        },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("share mints when the artifact is ready and stays null when it is not", async () => {
    const readyShare = await requireKit().invoke(shareDocument, {
      documentId: fixtures.invoice,
    });
    expect(readyShare.url).toMatch(/^https:\/\/documents\.test\/d\//);

    const [readyToken] = await requireKit()
      .db.runtime.db.select()
      .from(documentShareTokens)
      .where(
        and(
          eq(documentShareTokens.documentId, fixtures.invoice),
          isNull(documentShareTokens.revokedAt),
        ),
      );
    expect(readyToken?.pdfDownloadUrl).toMatch(/^https?:\/\//);

    const pendingShare = await requireKit().invoke(shareDocument, {
      documentId: fixtures.pendingShare,
    });
    expect(pendingShare.url).toMatch(/^https:\/\/documents\.test\/d\//);
    const [pendingToken] = await requireKit()
      .db.runtime.db.select()
      .from(documentShareTokens)
      .where(
        and(
          eq(documentShareTokens.documentId, fixtures.pendingShare),
          isNull(documentShareTokens.revokedAt),
        ),
      );
    expect(pendingToken?.pdfDownloadUrl).toBeNull();
  });

  it("failed job does not leave a catalog-purpose file", async () => {
    closeFilesObjectStore();
    const before = await countDocumentFiles();
    try {
      const result = await requireKit().invoke(
        renderPdf,
        createdEnvelope({
          documentId: fixtures.fail,
          type: "payment_invoice",
          documentNumber: "KA-РХ-000903",
        }),
      );
      expect(result.status).toBe("failed");
      expect(result.fileId).toBeNull();
      const leftover = await requireKit()
        .db.runtime.db.select()
        .from(files)
        .where(eq(files.id, artifactFileId(fixtures.fail)));
      expect(leftover).toHaveLength(0);
      expect(await countDocumentFiles()).toBe(before);
      const [job] = await requireKit()
        .db.runtime.db.select()
        .from(documentGenerationJobs)
        .where(eq(documentGenerationJobs.documentId, fixtures.fail));
      expect(job?.status).toBe("failed");
    } finally {
      configureFilesObjectStore(garageS3Config());
      await waitForBucket();
    }
  });
});
