import { createHash, randomBytes, randomUUID } from "node:crypto";

import { ActionRegistry } from "@showzy/core";
import {
  createTestKit,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { products } from "@showzy/db/schema/catalog";
import { companyCustomers } from "@showzy/db/schema/customers";
import {
  documentItems,
  documents,
  documentShareTokens,
} from "@showzy/db/schema/documents";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import {
  SHARE_LANDING_DOWNLOAD_COPY,
  SHARE_LANDING_NOT_FOUND_COPY,
  SHARE_LANDING_REFRESH_COPY,
} from "./document-share-landing.js";

const fixtures = {
  customerA: randomUUID(),
  productA: randomUUID(),
  docReady: randomUUID(),
  docNullPdf: randomUUID(),
};

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
  displayName: "Landing Buyer",
};

let kit: TestKit;
const readyToken = randomBytes(32).toString("base64url");
const nullPdfToken = randomBytes(32).toString("base64url");

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function insertSeedDocument(values: {
  id: string;
  documentNumber: string;
  orderNumber: number;
}): Promise<void> {
  const orderId = randomUUID();
  const unit = 750n;
  await kit.db.runtime.db.insert(orders).values({
    id: orderId,
    companyId: kitIdentities.companies.a,
    orderNumber: values.orderNumber,
    customerId: fixtures.customerA,
    status: "new",
    totalNetMinor: unit,
    totalTaxMinor: 0n,
    totalGrossMinor: unit,
    currency: "UAH",
  });
  await kit.db.runtime.db.insert(orderItems).values({
    id: randomUUID(),
    companyId: kitIdentities.companies.a,
    orderId,
    productId: fixtures.productA,
    titleSnapshot: "Seed line",
    quantityMilli: 1000n,
    unitPriceMinor: unit,
    taxTreatment: "exempt",
    netAmountMinor: unit,
    grossAmountMinor: unit,
    priceSource: "base",
    resolverVersion: 1,
  });
  await kit.db.runtime.db.insert(documents).values({
    id: values.id,
    companyId: kitIdentities.companies.a,
    orderId,
    counterpartyId: null,
    type: "payment_invoice",
    status: "issued",
    documentNumber: values.documentNumber,
    issuedOn: "2026-03-15",
    supplierDetails: sellerSnapshot,
    buyerDetails: customerBuyerSnapshot,
    totalNetMinor: unit,
    totalTaxMinor: 0n,
    totalGrossMinor: unit,
    currency: "UAH",
    templateSource: "system",
    templateName: "payment_invoice",
  });
  await kit.db.runtime.db.insert(documentItems).values({
    id: randomUUID(),
    companyId: kitIdentities.companies.a,
    documentId: values.id,
    productId: fixtures.productA,
    titleSnapshot: "Invoice line",
    quantityMilli: 1000n,
    unitPriceMinor: unit,
    taxTreatment: "exempt",
    netAmountMinor: unit,
    grossAmountMinor: unit,
    currency: "UAH",
  });
}

function landingApp() {
  return createApp({
    auth: {
      handler: () => Promise.resolve(new Response(null, { status: 404 })),
      api: { getSession: () => Promise.resolve(null) },
    },
    registry: new ActionRegistry(),
    contractModules: {},
    pipeline: kit.pipeline,
    trustedProxies: [],
    getPeerAddress: () => "203.0.113.10",
  });
}

beforeAll(async () => {
  kit = await createTestKit();
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const pdfFuture = new Date(Date.now() + 15 * 60 * 1000);

  await kit.db.runtime.db.insert(companyCustomers).values({
    id: fixtures.customerA,
    companyId: kitIdentities.companies.a,
    name: "Landing CRM",
    email: `customer-${fixtures.customerA}@example.com`,
  });
  await kit.db.runtime.db.insert(products).values({
    id: fixtures.productA,
    companyId: kitIdentities.companies.a,
    name: "Cake",
    basePriceMinor: 750n,
  });
  await insertSeedDocument({
    id: fixtures.docReady,
    documentNumber: "KA-РХ-000001",
    orderNumber: 1,
  });
  await insertSeedDocument({
    id: fixtures.docNullPdf,
    documentNumber: "KA-РХ-000002",
    orderNumber: 2,
  });
  await kit.db.runtime.db.insert(documentShareTokens).values([
    {
      companyId: kitIdentities.companies.a,
      documentId: fixtures.docReady,
      tokenHash: hashToken(readyToken),
      expiresAt: future,
      pdfDownloadUrl: "https://files.example/ready.pdf",
      pdfDownloadExpiresAt: pdfFuture,
    },
    {
      companyId: kitIdentities.companies.a,
      documentId: fixtures.docNullPdf,
      tokenHash: hashToken(nullPdfToken),
      expiresAt: future,
      pdfDownloadUrl: null,
      pdfDownloadExpiresAt: null,
    },
  ]);
});

afterAll(async () => {
  await kit.db.close();
});

describe("GET /d/:token landing", () => {
  it("returns 200 HTML without a session and offers download when the stored URL is live", async () => {
    const app = landingApp();
    const response = await app.request(`/d/${readyToken}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const html = await response.text();
    expect(html).toContain(SHARE_LANDING_DOWNLOAD_COPY);
    expect(html).toContain("https://files.example/ready.pdf");
    expect(html).toContain("KA-РХ-000001");
    expect(html).not.toContain(readyToken);
  });

  it("tells the holder to ask the sender to refresh when pdfDownloadUrl is null", async () => {
    const app = landingApp();
    const response = await app.request(`/d/${nullPdfToken}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(SHARE_LANDING_REFRESH_COPY);
  });

  it("returns 404 HTML for an unknown token and never 401", async () => {
    const app = landingApp();
    const response = await app.request("/d/unknown-landing-token");
    expect(response.status).toBe(404);
    expect(response.status).not.toBe(401);
    expect(await response.text()).toContain(SHARE_LANDING_NOT_FOUND_COPY);
  });
});
