import { randomUUID } from "node:crypto";

import {
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from "@showzy/core/errors";
import {
  createTestKit,
  crossTenantSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { user } from "@showzy/db/schema/auth";
import { products } from "@showzy/db/schema/catalog";
import { companyMembers } from "@showzy/db/schema/companies";
import { companyCustomers, counterparties } from "@showzy/db/schema/customers";
import { documentGenerationJobs } from "@showzy/db/schema/doc-generation";
import { signingSignatures } from "@showzy/db/schema/doc-signing";
import { documentItems, documents } from "@showzy/db/schema/documents";
import { files } from "@showzy/db/schema/files";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { getArtifact } from "@showzy/doc-generation/get-artifact";
import { getSigning } from "@showzy/doc-signing/get";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getForGeneration } from "./get-for-generation.js";
import { getDocument } from "./get.js";

const fixtures = {
  customerA: randomUUID(),
  customerB: randomUUID(),
  productA: randomUUID(),
  productB: randomUUID(),
  counterpartyA: randomUUID(),
  counterpartyB: randomUUID(),
  orderA: randomUUID(),
  orderSigned: randomUUID(),
  orderB: randomUUID(),
  docInvoice: randomUUID(),
  docDelivery: randomUUID(),
  docSigned: randomUUID(),
  docForeign: randomUUID(),
  asicSigned: randomUUID(),
  signatureSigned: randomUUID(),
  itemInvoice1: randomUUID(),
  itemInvoice2: randomUUID(),
  itemDelivery: randomUUID(),
  itemSigned: randomUUID(),
  itemForeign: randomUUID(),
  orderItemA: randomUUID(),
  orderItemB: randomUUID(),
};

const clerkUserId = randomUUID();

const createdAt = new Date("2026-03-15T12:00:00.000Z");
const lineOneAt = new Date("2026-03-15T12:00:01.000Z");
const lineTwoAt = new Date("2026-03-15T12:00:02.000Z");

const sellerSnapshot = {
  kind: "seller" as const,
  name: "Konditerska Anna",
  prefix: "KA",
  companyType: "tov" as const,
  legalName: "ТОВ Альфа",
  edrpou: "12345678",
  legalAddress: "вул. Хрещатик, 1",
  iban: "UA123456789012345678901234567",
  bankName: "ПриватБанк",
  bankMfo: "300001",
  bankEdrpou: "12345678",
  phone: "+380501111111",
  email: "legal@alpha.test",
};

const customerBuyerSnapshot = {
  kind: "customer" as const,
  displayName: "Snapshotted Buyer",
};

const counterpartyBuyerSnapshot = {
  kind: "counterparty" as const,
  name: "Snapshotted Legal",
  edrpou: "11223344",
  legalAddress: "вул. Покупця, 2",
  iban: "UA111111111111111111111111111",
  bankName: "Ощадбанк",
  bankMfo: "300335",
  phone: "+380502222222",
  email: "buyer@example.com",
  notes: "Linked buyer",
};

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();
  const companyA = kitIdentities.companies.a;
  const companyB = kitIdentities.companies.b;

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

  await kit.db.runtime.db.insert(orders).values([
    {
      id: fixtures.orderA,
      companyId: companyA,
      orderNumber: "T-1",
      customerId: fixtures.customerA,
      status: "new",
      totalNetMinor: 750n,
      totalTaxMinor: 0n,
      totalGrossMinor: 750n,
      currency: "UAH",
    },
    {
      id: fixtures.orderSigned,
      companyId: companyA,
      orderNumber: "T-2",
      customerId: fixtures.customerA,
      status: "new",
      totalNetMinor: 250n,
      totalTaxMinor: 0n,
      totalGrossMinor: 250n,
      currency: "UAH",
    },
    {
      id: fixtures.orderB,
      companyId: companyB,
      orderNumber: "T-1",
      customerId: fixtures.customerB,
      status: "new",
      totalNetMinor: 100n,
      totalTaxMinor: 0n,
      totalGrossMinor: 100n,
      currency: "UAH",
    },
  ]);
  await kit.db.runtime.db.insert(orderItems).values([
    {
      id: fixtures.orderItemA,
      companyId: companyA,
      orderId: fixtures.orderA,
      productId: fixtures.productA,
      titleSnapshot: "Order seed A",
      quantityMilli: 1000n,
      unitPriceMinor: 750n,
      taxTreatment: "exempt",
      netAmountMinor: 750n,
      grossAmountMinor: 750n,
      priceSource: "base",
      resolverVersion: 1,
    },
    {
      id: fixtures.orderItemB,
      companyId: companyB,
      orderId: fixtures.orderB,
      productId: fixtures.productB,
      titleSnapshot: "Order seed B",
      quantityMilli: 1000n,
      unitPriceMinor: 100n,
      taxTreatment: "exempt",
      netAmountMinor: 100n,
      grossAmountMinor: 100n,
      priceSource: "base",
      resolverVersion: 1,
    },
  ]);

  await kit.db.runtime.db.insert(documents).values([
    {
      id: fixtures.docInvoice,
      companyId: companyA,
      orderId: fixtures.orderA,
      counterpartyId: null,
      type: "payment_invoice",
      status: "issued",
      documentNumber: "KA-РХ-000010",
      issuedOn: "2026-03-15",
      supplierDetails: sellerSnapshot,
      buyerDetails: customerBuyerSnapshot,
      totalNetMinor: 750n,
      totalTaxMinor: 0n,
      totalGrossMinor: 750n,
      currency: "UAH",
      templateSource: "system",
      templateName: "payment_invoice",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: fixtures.docDelivery,
      companyId: companyA,
      orderId: fixtures.orderA,
      counterpartyId: fixtures.counterpartyA,
      type: "delivery_note",
      status: "issued",
      documentNumber: "KA-ВН-000010",
      issuedOn: "2026-03-15",
      supplierDetails: sellerSnapshot,
      buyerDetails: counterpartyBuyerSnapshot,
      totalNetMinor: 250n,
      totalTaxMinor: 0n,
      totalGrossMinor: 250n,
      currency: "UAH",
      templateSource: "system",
      templateName: "delivery_note",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: fixtures.docSigned,
      companyId: companyA,
      orderId: fixtures.orderSigned,
      counterpartyId: null,
      type: "payment_invoice",
      status: "issued",
      documentNumber: "KA-РХ-000011",
      issuedOn: "2026-03-15",
      supplierDetails: sellerSnapshot,
      buyerDetails: customerBuyerSnapshot,
      totalNetMinor: 250n,
      totalTaxMinor: 0n,
      totalGrossMinor: 250n,
      currency: "UAH",
      templateSource: "system",
      templateName: "payment_invoice",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: fixtures.docForeign,
      companyId: companyB,
      orderId: fixtures.orderB,
      counterpartyId: fixtures.counterpartyB,
      type: "payment_invoice",
      status: "issued",
      documentNumber: "KB-РХ-000010",
      issuedOn: "2026-03-15",
      supplierDetails: sellerSnapshot,
      buyerDetails: customerBuyerSnapshot,
      totalNetMinor: 100n,
      totalTaxMinor: 0n,
      totalGrossMinor: 100n,
      currency: "UAH",
      templateSource: "system",
      templateName: "payment_invoice",
      createdAt,
      updatedAt: createdAt,
    },
  ]);

  await kit.db.runtime.db.insert(documentItems).values([
    {
      id: fixtures.itemInvoice1,
      companyId: companyA,
      documentId: fixtures.docInvoice,
      productId: fixtures.productA,
      titleSnapshot: "Line one",
      quantityMilli: 1000n,
      unitPriceMinor: 250n,
      taxTreatment: "exempt",
      netAmountMinor: 250n,
      grossAmountMinor: 250n,
      currency: "UAH",
      createdAt: lineOneAt,
    },
    {
      id: fixtures.itemInvoice2,
      companyId: companyA,
      documentId: fixtures.docInvoice,
      productId: fixtures.productA,
      titleSnapshot: "Line two",
      quantityMilli: 2000n,
      unitPriceMinor: 250n,
      taxTreatment: "exempt",
      netAmountMinor: 500n,
      grossAmountMinor: 500n,
      currency: "UAH",
      createdAt: lineTwoAt,
    },
    {
      id: fixtures.itemDelivery,
      companyId: companyA,
      documentId: fixtures.docDelivery,
      productId: fixtures.productA,
      titleSnapshot: "Delivery line",
      quantityMilli: 1000n,
      unitPriceMinor: 250n,
      taxTreatment: "exempt",
      netAmountMinor: 250n,
      grossAmountMinor: 250n,
      currency: "UAH",
      createdAt,
    },
    {
      id: fixtures.itemSigned,
      companyId: companyA,
      documentId: fixtures.docSigned,
      productId: fixtures.productA,
      titleSnapshot: "Signed line",
      quantityMilli: 1000n,
      unitPriceMinor: 250n,
      taxTreatment: "exempt",
      netAmountMinor: 250n,
      grossAmountMinor: 250n,
      currency: "UAH",
      createdAt,
    },
    {
      id: fixtures.itemForeign,
      companyId: companyB,
      documentId: fixtures.docForeign,
      productId: fixtures.productB,
      titleSnapshot: "Foreign line",
      quantityMilli: 1000n,
      unitPriceMinor: 100n,
      taxTreatment: "exempt",
      netAmountMinor: 100n,
      grossAmountMinor: 100n,
      currency: "UAH",
      createdAt,
    },
  ]);

  await kit.db.runtime.db.insert(documentGenerationJobs).values({
    companyId: companyA,
    documentId: fixtures.docInvoice,
    status: "pending",
    fileId: null,
  });

  await kit.db.runtime.db.insert(files).values({
    id: fixtures.asicSigned,
    companyId: companyA,
    uploadedByUserId: kitIdentities.users.anna,
    purpose: "signing",
    mimeType: "application/vnd.etsi.asic-e+zip",
    byteSize: 2048n,
    objectKey: `${companyA}/signing/${fixtures.asicSigned}`,
    status: "ready",
    checksumSha256: "b".repeat(64),
    stagingPurgedAt: new Date("2026-08-30T00:00:00.000Z"),
  });
  await kit.db.runtime.db.insert(signingSignatures).values({
    id: fixtures.signatureSigned,
    companyId: companyA,
    documentId: fixtures.docSigned,
    signerRole: "supplier",
    fileId: fixtures.asicSigned,
    signerCn: "ФОП Fixture",
    signerOrg: "Fixture Org",
    signerTaxId: "12345678",
    signatureAlg: "DSTU4145",
    signedAt: createdAt,
  });

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@documents-get-kit.test",
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
      getDocument,
      { input: { documentId: fixtures.docInvoice } },
      { input: { documentId: fixtures.docForeign } },
    ),
    isolationCase(
      getForGeneration,
      { input: { documentId: fixtures.docInvoice } },
      { input: { documentId: fixtures.docForeign } },
    ),
    isolationCase(
      getArtifact,
      { input: { documentId: fixtures.docInvoice } },
      { input: { documentId: fixtures.docForeign } },
    ),
    isolationCase(
      getSigning,
      { input: { documentId: fixtures.docInvoice } },
      {
        companyId: kitIdentities.companies.b,
        input: { documentId: fixtures.docInvoice },
      },
    ),
  ],
);

describe("documents.get", () => {
  it("returns snapshots, items, and a pending generation chip when no job is ready", async () => {
    const result = await kit.invoke(getDocument, {
      documentId: fixtures.docInvoice,
    });

    expect(result.documentId).toBe(fixtures.docInvoice);
    expect(result.orderId).toBe(fixtures.orderA);
    expect(result.counterpartyId).toBeNull();
    expect(result.type).toBe("payment_invoice");
    expect(result.status).toBe("issued");
    expect(result.documentNumber).toBe("KA-РХ-000010");
    expect(result.issuedOn).toBe("2026-03-15");
    expect(result.createdAt).toBe(createdAt.toISOString());
    expect(result.templateSource).toBe("system");
    expect(result.templateName).toBe("payment_invoice");
    expect(result.totalNetMinor).toBe("750");
    expect(result.totalTaxMinor).toBe("0");
    expect(result.totalGrossMinor).toBe("750");
    expect(result.currency).toBe("UAH");
    expect(result.generation).toEqual({ status: "pending", fileId: null });
    expect(result.pdfDownloadUrl).toBeNull();
    expect(result.signing).toEqual({ status: "unsigned" });
    expect(result.buyerDetails).toEqual(customerBuyerSnapshot);
    expect(result.supplierDetails).toEqual(sellerSnapshot);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.itemId)).toEqual([
      fixtures.itemInvoice1,
      fixtures.itemInvoice2,
    ]);
    expect(result.items[0]).toMatchObject({
      titleSnapshot: "Line one",
      quantityMilli: "1000",
      unitPriceMinor: "250",
      netAmountMinor: "250",
      grossAmountMinor: "250",
      discountKind: "none",
      taxTreatment: "exempt",
      currency: "UAH",
    });
    expect(result.items[1]).toMatchObject({
      titleSnapshot: "Line two",
      quantityMilli: "2000",
      grossAmountMinor: "500",
    });
    const blob = JSON.stringify(result);
    expect(blob).not.toContain("Live CRM Name");
    expect(blob).not.toContain(fixtures.docForeign);
  });

  it("returns a counterparty legal-face buyer snapshot", async () => {
    const result = await kit.invoke(getDocument, {
      documentId: fixtures.docDelivery,
    });
    expect(result.type).toBe("delivery_note");
    expect(result.counterpartyId).toBe(fixtures.counterpartyA);
    expect(result.buyerDetails).toEqual(counterpartyBuyerSnapshot);
    expect(result.generation).toEqual({ status: "pending", fileId: null });
    expect(result.pdfDownloadUrl).toBeNull();
    expect(result.signing).toEqual({ status: "unsigned" });
    expect(JSON.stringify(result)).not.toContain("Live Legal Face");
  });

  it("nests the supplier signing chip and keeps unsigned pdfDownloadUrl", async () => {
    const unsigned = await kit.invoke(getDocument, {
      documentId: fixtures.docInvoice,
    });
    expect(unsigned.signing).toEqual({ status: "unsigned" });
    expect(unsigned.pdfDownloadUrl).toBeNull();
    expect(unsigned).toHaveProperty("pdfDownloadUrl");
    expect(unsigned).not.toHaveProperty("signedDownloadUrl");

    const signed = await kit.invoke(getDocument, {
      documentId: fixtures.docSigned,
    });
    expect(signed.signing).toEqual({
      status: "supplier_signed",
      signedFileId: fixtures.asicSigned,
    });
    expect(signed.pdfDownloadUrl).toBeNull();
    expect(signed).toHaveProperty("pdfDownloadUrl");
    expect(signed).not.toHaveProperty("signedDownloadUrl");
  });

  it("denies staff without documents:view", async () => {
    await expect(
      kit.invoke(
        getDocument,
        { documentId: fixtures.docInvoice },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a malformed documentId", async () => {
    await expect(
      kit.invoke(getDocument, { documentId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails missing and foreign documents with the same not-found", async () => {
    const missingId = randomUUID();
    const missingError = await kit
      .invoke(getDocument, { documentId: missingId })
      .then(
        () => {
          throw new Error("expected NotFoundError for a missing document");
        },
        (error: unknown) => error,
      );
    const foreignError = await kit
      .invoke(getDocument, { documentId: fixtures.docForeign })
      .then(
        () => {
          throw new Error("expected NotFoundError for a foreign document");
        },
        (error: unknown) => error,
      );

    expect(missingError).toBeInstanceOf(NotFoundError);
    expect(foreignError).toBeInstanceOf(NotFoundError);
    if (
      missingError instanceof NotFoundError &&
      foreignError instanceof NotFoundError
    ) {
      expect(missingError.clientMessage).toBe(foreignError.clientMessage);
    }
  });
});
