import { randomUUID } from "node:crypto";

import { PermissionDeniedError, ValidationError } from "@showzy/core/errors";
import {
  createTestKit,
  crossTenantSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { user } from "@showzy/db/schema/auth";
import { products } from "@showzy/db/schema/catalog";
import { companies, companyMembers } from "@showzy/db/schema/companies";
import { companyCustomers, counterparties } from "@showzy/db/schema/customers";
import { signingSignatures } from "@showzy/db/schema/doc-signing";
import { documentItems, documents } from "@showzy/db/schema/documents";
import { files } from "@showzy/db/schema/files";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { getSupplierSignedFlags } from "@showzy/doc-signing/get-supplier-signed-flags";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listDocuments } from "./list.js";
import {
  formatListDocumentsCursor,
  LIST_DOCUMENTS_MAX_LIMIT,
} from "./list.contract.js";

const fixtures = {
  emptyCompany: randomUUID(),
  customerA: randomUUID(),
  customerB: randomUUID(),
  productA: randomUUID(),
  productB: randomUUID(),
  counterpartyA: randomUUID(),
  counterpartyB: randomUUID(),
  orderOlder: randomUUID(),
  orderShared: randomUUID(),
  orderNewest: randomUUID(),
  orderCancelled: randomUUID(),
  orderForeign: randomUUID(),
  docOlder: randomUUID(),
  docSharedInvoice: randomUUID(),
  docSharedDelivery: randomUUID(),
  docNewest: randomUUID(),
  docCancelled: randomUUID(),
  docForeign: randomUUID(),
  asicNewest: randomUUID(),
  signatureNewest: randomUUID(),
  itemOlder: randomUUID(),
  itemSharedInvoice: randomUUID(),
  itemSharedDelivery: randomUUID(),
  itemNewest: randomUUID(),
  itemCancelled: randomUUID(),
  itemForeign: randomUUID(),
  orderItemOlder: randomUUID(),
  orderItemShared: randomUUID(),
  orderItemNewest: randomUUID(),
  orderItemCancelled: randomUUID(),
  orderItemForeign: randomUUID(),
};

const clerkUserId = randomUUID();

const timestamps = {
  older: new Date("2026-01-01T00:00:00.000Z"),
  sharedInvoice: new Date("2026-02-01T00:00:00.000Z"),
  sharedDelivery: new Date("2026-02-02T00:00:00.000Z"),
  newest: new Date("2026-03-01T00:00:00.000Z"),
  cancelled: new Date("2026-04-01T00:00:00.000Z"),
  foreign: new Date("2026-05-01T00:00:00.000Z"),
};

const sellerSnapshot = {
  kind: "seller" as const,
  name: "Konditerska Anna",
  prefix: "KA",
  companyType: "tov" as const,
  legalName: "ТОВ Альфа",
  edrpou: "12345678",
  legalAddress: null,
  iban: null,
  bankName: null,
  bankMfo: null,
  bankEdrpou: null,
  phone: null,
  email: null,
};

const customerBuyerSnapshot = {
  kind: "customer" as const,
  displayName: "Snapshotted Buyer",
};

const counterpartyBuyerSnapshot = {
  kind: "counterparty" as const,
  name: "Snapshotted Legal",
  edrpou: "11223344",
  legalAddress: null,
  iban: null,
  bankName: null,
  bankMfo: null,
  phone: null,
  email: null,
  notes: null,
};

let kit: TestKit;
const seedOrderNumbers = new Map<string, number>();

function nextOrderNumber(companyId: string): string {
  const next = (seedOrderNumbers.get(companyId) ?? 0) + 1;
  seedOrderNumbers.set(companyId, next);
  return `T-${String(next)}`;
}

async function insertOrder(values: {
  id: string;
  itemId: string;
  companyId: string;
  customerId: string | null;
  productId: string;
}): Promise<void> {
  await kit.db.runtime.db.insert(orders).values({
    id: values.id,
    companyId: values.companyId,
    orderNumber: nextOrderNumber(values.companyId),
    customerId: values.customerId,
    status: "new",
    totalNetMinor: 250n,
    totalTaxMinor: 0n,
    totalGrossMinor: 250n,
    currency: "UAH",
  });
  await kit.db.runtime.db.insert(orderItems).values({
    id: values.itemId,
    companyId: values.companyId,
    orderId: values.id,
    productId: values.productId,
    titleSnapshot: "Order seed",
    quantityMilli: 1000n,
    unitPriceMinor: 250n,
    taxTreatment: "exempt",
    netAmountMinor: 250n,
    grossAmountMinor: 250n,
    priceSource: "base",
    resolverVersion: 1,
  });
}

async function insertDocument(values: {
  id: string;
  itemId: string;
  companyId: string;
  orderId: string;
  counterpartyId: string | null;
  type: "payment_invoice" | "delivery_note";
  status: "issued" | "cancelled";
  documentNumber: string;
  issuedOn: string;
  createdAt: Date;
  productId: string;
  buyerDetails: typeof customerBuyerSnapshot | typeof counterpartyBuyerSnapshot;
  totalGrossMinor: bigint;
}): Promise<void> {
  await kit.db.runtime.db.insert(documents).values({
    id: values.id,
    companyId: values.companyId,
    orderId: values.orderId,
    counterpartyId: values.counterpartyId,
    type: values.type,
    status: values.status,
    documentNumber: values.documentNumber,
    issuedOn: values.issuedOn,
    supplierDetails: sellerSnapshot,
    buyerDetails: values.buyerDetails,
    totalNetMinor: values.totalGrossMinor,
    totalTaxMinor: 0n,
    totalGrossMinor: values.totalGrossMinor,
    currency: "UAH",
    templateSource: "system",
    templateName: values.type,
    createdAt: values.createdAt,
    updatedAt: values.createdAt,
  });
  await kit.db.runtime.db.insert(documentItems).values({
    id: values.itemId,
    companyId: values.companyId,
    documentId: values.id,
    productId: values.productId,
    titleSnapshot: "Document seed",
    quantityMilli: 1000n,
    unitPriceMinor: values.totalGrossMinor,
    taxTreatment: "exempt",
    netAmountMinor: values.totalGrossMinor,
    grossAmountMinor: values.totalGrossMinor,
    currency: "UAH",
    createdAt: values.createdAt,
  });
}

beforeAll(async () => {
  kit = await createTestKit();
  const companyA = kitIdentities.companies.a;
  const companyB = kitIdentities.companies.b;

  await kit.db.runtime.db.insert(companies).values({
    id: fixtures.emptyCompany,
    name: "Empty documents list",
    slug: "empty-documents-list-sho233",
    prefix: "ED",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: fixtures.emptyCompany,
    userId: kitIdentities.users.anna,
    role: "owner",
    permissions: { granted: [], denied: [] },
  });

  await kit.db.runtime.db.insert(companyCustomers).values([
    {
      id: fixtures.customerA,
      companyId: companyA,
      name: "Live CRM Name",
      email: `customer-${fixtures.customerA}@example.com`,
    },
    {
      id: fixtures.customerB,
      companyId: companyB,
      name: "Foreign Live CRM",
      email: `customer-${fixtures.customerB}@example.com`,
    },
  ]);

  await kit.db.runtime.db.insert(products).values([
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

  await kit.db.runtime.db.insert(counterparties).values([
    {
      id: fixtures.counterpartyA,
      companyId: companyA,
      customerId: fixtures.customerA,
      name: "Live Legal Face",
      edrpou: "99887766",
    },
    {
      id: fixtures.counterpartyB,
      companyId: companyB,
      customerId: fixtures.customerB,
      name: "Foreign Legal",
    },
  ]);

  await insertOrder({
    id: fixtures.orderOlder,
    itemId: fixtures.orderItemOlder,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
  });
  await insertOrder({
    id: fixtures.orderShared,
    itemId: fixtures.orderItemShared,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
  });
  await insertOrder({
    id: fixtures.orderNewest,
    itemId: fixtures.orderItemNewest,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
  });
  await insertOrder({
    id: fixtures.orderCancelled,
    itemId: fixtures.orderItemCancelled,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
  });
  await insertOrder({
    id: fixtures.orderForeign,
    itemId: fixtures.orderItemForeign,
    companyId: companyB,
    customerId: fixtures.customerB,
    productId: fixtures.productB,
  });

  await insertDocument({
    id: fixtures.docOlder,
    itemId: fixtures.itemOlder,
    companyId: companyA,
    orderId: fixtures.orderOlder,
    counterpartyId: null,
    type: "payment_invoice",
    status: "issued",
    documentNumber: "KA-РХ-000001",
    issuedOn: "2026-01-01",
    createdAt: timestamps.older,
    productId: fixtures.productA,
    buyerDetails: customerBuyerSnapshot,
    totalGrossMinor: 100n,
  });
  await insertDocument({
    id: fixtures.docSharedInvoice,
    itemId: fixtures.itemSharedInvoice,
    companyId: companyA,
    orderId: fixtures.orderShared,
    counterpartyId: null,
    type: "payment_invoice",
    status: "issued",
    documentNumber: "KA-РХ-000002",
    issuedOn: "2026-02-01",
    createdAt: timestamps.sharedInvoice,
    productId: fixtures.productA,
    buyerDetails: customerBuyerSnapshot,
    totalGrossMinor: 200n,
  });
  await insertDocument({
    id: fixtures.docSharedDelivery,
    itemId: fixtures.itemSharedDelivery,
    companyId: companyA,
    orderId: fixtures.orderShared,
    counterpartyId: fixtures.counterpartyA,
    type: "delivery_note",
    status: "issued",
    documentNumber: "KA-ВН-000001",
    issuedOn: "2026-02-02",
    createdAt: timestamps.sharedDelivery,
    productId: fixtures.productA,
    buyerDetails: counterpartyBuyerSnapshot,
    totalGrossMinor: 300n,
  });
  await insertDocument({
    id: fixtures.docNewest,
    itemId: fixtures.itemNewest,
    companyId: companyA,
    orderId: fixtures.orderNewest,
    counterpartyId: null,
    type: "payment_invoice",
    status: "issued",
    documentNumber: "KA-РХ-000003",
    issuedOn: "2026-03-01",
    createdAt: timestamps.newest,
    productId: fixtures.productA,
    buyerDetails: customerBuyerSnapshot,
    totalGrossMinor: 400n,
  });
  await insertDocument({
    id: fixtures.docCancelled,
    itemId: fixtures.itemCancelled,
    companyId: companyA,
    orderId: fixtures.orderCancelled,
    counterpartyId: null,
    type: "payment_invoice",
    status: "cancelled",
    documentNumber: "KA-РХ-000004",
    issuedOn: "2026-04-01",
    createdAt: timestamps.cancelled,
    productId: fixtures.productA,
    buyerDetails: customerBuyerSnapshot,
    totalGrossMinor: 500n,
  });
  await insertDocument({
    id: fixtures.docForeign,
    itemId: fixtures.itemForeign,
    companyId: companyB,
    orderId: fixtures.orderForeign,
    counterpartyId: fixtures.counterpartyB,
    type: "payment_invoice",
    status: "issued",
    documentNumber: "KB-РХ-000001",
    issuedOn: "2026-05-01",
    createdAt: timestamps.foreign,
    productId: fixtures.productB,
    buyerDetails: customerBuyerSnapshot,
    totalGrossMinor: 999n,
  });

  await kit.db.runtime.db.insert(files).values({
    id: fixtures.asicNewest,
    companyId: companyA,
    uploadedByUserId: kitIdentities.users.anna,
    purpose: "signing",
    mimeType: "application/vnd.etsi.asic-e+zip",
    byteSize: 2048n,
    objectKey: `${companyA}/signing/${fixtures.asicNewest}`,
    status: "ready",
    checksumSha256: "b".repeat(64),
    stagingPurgedAt: new Date("2026-08-30T00:00:00.000Z"),
  });
  await kit.db.runtime.db.insert(signingSignatures).values({
    id: fixtures.signatureNewest,
    companyId: companyA,
    documentId: fixtures.docNewest,
    signerRole: "supplier",
    fileId: fixtures.asicNewest,
    signerCn: "ФОП Fixture",
    signerOrg: "Fixture Org",
    signerTaxId: "12345678",
    signatureAlg: "DSTU4145",
    signedAt: timestamps.newest,
  });

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@documents-list-kit.test",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: companyA,
    userId: clerkUserId,
    role: "employee",
    permissions: { granted: [], denied: ["documents:view"] },
  });
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      listDocuments,
      { input: {} },
      {
        input: {},
        companyId: kitIdentities.companies.b,
        userId: kitIdentities.users.anna,
      },
    ),
    isolationCase(
      getSupplierSignedFlags,
      { input: { documentIds: [fixtures.docNewest] } },
      {
        companyId: kitIdentities.companies.b,
        input: { documentIds: [fixtures.docNewest] },
      },
    ),
  ],
);

describe("documents.list", () => {
  it("lists documents newest-first with list-row fields from the stored snapshot", async () => {
    const result = await kit.invoke(listDocuments, {});

    expect(result.items.map((row) => row.documentId)).toEqual([
      fixtures.docCancelled,
      fixtures.docNewest,
      fixtures.docSharedDelivery,
      fixtures.docSharedInvoice,
      fixtures.docOlder,
    ]);
    expect(result.nextCursor).toBeNull();

    const cancelled = result.items[0];
    expect(cancelled).toEqual({
      documentId: fixtures.docCancelled,
      type: "payment_invoice",
      documentNumber: "KA-РХ-000004",
      orderId: fixtures.orderCancelled,
      counterpartyId: null,
      status: "cancelled",
      totalGrossMinor: "500",
      currency: "UAH",
      issuedOn: "2026-04-01",
      createdAt: timestamps.cancelled.toISOString(),
      buyerLabel: "Snapshotted Buyer",
      supplierSigned: false,
    });

    const newest = result.items.find(
      (row) => row.documentId === fixtures.docNewest,
    );
    expect(newest?.supplierSigned).toBe(true);

    const delivery = result.items.find(
      (row) => row.documentId === fixtures.docSharedDelivery,
    );
    expect(delivery).toMatchObject({
      type: "delivery_note",
      documentNumber: "KA-ВН-000001",
      orderId: fixtures.orderShared,
      counterpartyId: fixtures.counterpartyA,
      buyerLabel: "Snapshotted Legal",
      totalGrossMinor: "300",
      supplierSigned: false,
    });

    expect(Object.keys(cancelled ?? {}).toSorted()).toEqual([
      "buyerLabel",
      "counterpartyId",
      "createdAt",
      "currency",
      "documentId",
      "documentNumber",
      "issuedOn",
      "orderId",
      "status",
      "supplierSigned",
      "totalGrossMinor",
      "type",
    ]);
    const blob = JSON.stringify(result);
    expect(blob).not.toContain("titleSnapshot");
    expect(blob).not.toContain("supplierDetails");
    expect(blob).not.toContain("Live CRM Name");
    expect(blob).not.toContain("Live Legal Face");
    expect(blob).not.toContain(fixtures.docForeign);
  });

  it("filters by type and returns an empty page for an empty company", async () => {
    const invoices = await kit.invoke(listDocuments, {
      type: "payment_invoice",
    });
    expect(invoices.items.map((row) => row.documentId)).toEqual([
      fixtures.docCancelled,
      fixtures.docNewest,
      fixtures.docSharedInvoice,
      fixtures.docOlder,
    ]);
    expect(invoices.items.every((row) => row.type === "payment_invoice")).toBe(
      true,
    );

    const notes = await kit.invoke(listDocuments, { type: "delivery_note" });
    expect(notes.items.map((row) => row.documentId)).toEqual([
      fixtures.docSharedDelivery,
    ]);

    const empty = await kit.invoke(
      listDocuments,
      {},
      { companyId: fixtures.emptyCompany },
    );
    expect(empty).toEqual({ items: [], nextCursor: null });
  });

  it("filters by own order and returns an empty page for missing or foreign orders", async () => {
    const shared = await kit.invoke(listDocuments, {
      orderId: fixtures.orderShared,
    });
    expect(shared.items.map((row) => row.documentId)).toEqual([
      fixtures.docSharedDelivery,
      fixtures.docSharedInvoice,
    ]);
    expect(
      shared.items.every((row) => row.orderId === fixtures.orderShared),
    ).toBe(true);

    const older = await kit.invoke(listDocuments, {
      orderId: fixtures.orderOlder,
    });
    expect(older.items.map((row) => row.documentId)).toEqual([
      fixtures.docOlder,
    ]);

    const foreignOrder = await kit.invoke(listDocuments, {
      orderId: fixtures.orderForeign,
    });
    expect(foreignOrder).toEqual({ items: [], nextCursor: null });
    expect(JSON.stringify(foreignOrder)).not.toContain(fixtures.docForeign);
    expect(JSON.stringify(foreignOrder)).not.toContain(fixtures.orderForeign);

    const missing = await kit.invoke(listDocuments, {
      orderId: randomUUID(),
    });
    expect(missing).toEqual({ items: [], nextCursor: null });
  });

  it("paginates on createdAt/id and stops at the last page", async () => {
    const first = await kit.invoke(listDocuments, { limit: 2 });
    expect(first.items.map((row) => row.documentId)).toEqual([
      fixtures.docCancelled,
      fixtures.docNewest,
    ]);
    expect(first.nextCursor).toBe(
      formatListDocumentsCursor(timestamps.newest, fixtures.docNewest),
    );

    const second = await kit.invoke(listDocuments, {
      limit: 2,
      cursor: first.nextCursor ?? "",
    });
    expect(second.items.map((row) => row.documentId)).toEqual([
      fixtures.docSharedDelivery,
      fixtures.docSharedInvoice,
    ]);
    expect(second.nextCursor).toBe(
      formatListDocumentsCursor(
        timestamps.sharedInvoice,
        fixtures.docSharedInvoice,
      ),
    );

    const third = await kit.invoke(listDocuments, {
      limit: 2,
      cursor: second.nextCursor ?? "",
    });
    expect(third.items.map((row) => row.documentId)).toEqual([
      fixtures.docOlder,
    ]);
    expect(third.nextCursor).toBeNull();
  });

  it("does not include another company's documents", async () => {
    const result = await kit.invoke(listDocuments, { type: "all" });
    expect(result.items.map((row) => row.documentId)).not.toContain(
      fixtures.docForeign,
    );
    const blob = JSON.stringify(result);
    expect(blob).not.toContain(fixtures.docForeign);
    expect(blob).not.toContain(kitIdentities.companies.b);

    const fromForeign = await kit.invoke(listDocuments, {
      cursor: formatListDocumentsCursor(
        timestamps.foreign,
        fixtures.docForeign,
      ),
    });
    expect(fromForeign.items.map((row) => row.documentId)).toEqual([
      fixtures.docCancelled,
      fixtures.docNewest,
      fixtures.docSharedDelivery,
      fixtures.docSharedInvoice,
      fixtures.docOlder,
    ]);
    expect(JSON.stringify(fromForeign)).not.toContain(fixtures.docForeign);
  });

  it("denies staff without documents:view", async () => {
    await expect(
      kit.invoke(
        listDocuments,
        {},
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a bad cursor, oversized limit, and companyId", async () => {
    await expect(
      kit.invoke(listDocuments, { cursor: "not-a-cursor" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listDocuments, {
        limit: LIST_DOCUMENTS_MAX_LIMIT + 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listDocuments, { limit: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(listDocuments, { orderId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
