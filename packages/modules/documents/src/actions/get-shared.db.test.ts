import { randomUUID } from "node:crypto";

import {
  createInMemoryRateLimitStore,
  createRateLimitHook,
  rateLimitDefaults,
} from "@showzy/core";
import {
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@showzy/core/errors";
import {
  createCapturingLogger,
  createTestKit,
  crossTenantSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { auditLog, domainEvents } from "@showzy/db";
import { products } from "@showzy/db/schema/catalog";
import { companyCustomers } from "@showzy/db/schema/customers";
import {
  documentItems,
  documents,
  documentShareTokens,
} from "@showzy/db/schema/documents";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { readCrmSentinel } from "@showzy/db/testing/fixtures";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getShared } from "./get-shared.js";
import { shareDocument } from "./share.js";
import { configureDocumentShareOrigin } from "../services/share-origin.js";
import {
  generateDocumentShareToken,
  hashDocumentShareToken,
} from "../services/token-hash.js";

const TEST_ORIGIN = "https://documents.test";
const FROZEN_NOW_MS = 1_000_000;

const fixtures = {
  customerA: randomUUID(),
  customerB: randomUUID(),
  productA: randomUUID(),
  productB: randomUUID(),
  docA: randomUUID(),
  docB: randomUUID(),
  docExpired: randomUUID(),
  docRevoked: randomUUID(),
  docPdfExpired: randomUUID(),
  docSignedExpired: randomUUID(),
  docSignedLive: randomUUID(),
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
  displayName: "Snapshotted Buyer",
};

let kit: TestKit;
const tokens = {
  a: "",
  b: "",
};
const ownIsolationInput = { token: "" };
const expiredToken = generateDocumentShareToken();
const revokedToken = generateDocumentShareToken();
const pdfExpiredToken = generateDocumentShareToken();
const signedExpiredToken = generateDocumentShareToken();
const signedLiveToken = generateDocumentShareToken();
const seedOrderNumbers = new Map<string, number>();

function nextSeedOrderNumber(companyId: string): string {
  const next = (seedOrderNumbers.get(companyId) ?? 0) + 1;
  seedOrderNumbers.set(companyId, next);
  return `T-${String(next)}`;
}

async function insertSeedDocument(values: {
  id: string;
  companyId: string;
  customerId: string;
  productId: string;
  documentNumber: string;
}): Promise<void> {
  const orderId = randomUUID();
  const unit = 250n;
  await kit.db.runtime.db.insert(orders).values({
    id: orderId,
    companyId: values.companyId,
    orderNumber: nextSeedOrderNumber(values.companyId),
    customerId: values.customerId,
    customerNameSnapshot: "Fixture customer",
    status: "new",
    totalNetMinor: unit,
    totalTaxMinor: 0n,
    totalGrossMinor: unit,
    currency: "UAH",
  });
  await kit.db.runtime.db.insert(orderItems).values({
    id: randomUUID(),
    companyId: values.companyId,
    orderId,
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
  await kit.db.runtime.db.insert(documents).values({
    id: values.id,
    companyId: values.companyId,
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
    companyId: values.companyId,
    documentId: values.id,
    productId: values.productId,
    titleSnapshot: "Invoice line",
    quantityMilli: 1000n,
    unitPriceMinor: unit,
    taxTreatment: "exempt",
    netAmountMinor: unit,
    grossAmountMinor: unit,
    currency: "UAH",
  });
}

async function insertTokenRow(values: {
  documentId: string;
  companyId: string;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  pdfDownloadUrl: string | null;
  pdfDownloadExpiresAt: Date | null;
  signedDownloadUrl?: string | null;
  signedDownloadExpiresAt?: Date | null;
}): Promise<void> {
  await kit.db.runtime.db.insert(documentShareTokens).values({
    companyId: values.companyId,
    documentId: values.documentId,
    tokenHash: hashDocumentShareToken(values.token),
    expiresAt: values.expiresAt,
    revokedAt: values.revokedAt,
    pdfDownloadUrl: values.pdfDownloadUrl,
    pdfDownloadExpiresAt: values.pdfDownloadExpiresAt,
    signedDownloadUrl: values.signedDownloadUrl ?? null,
    signedDownloadExpiresAt: values.signedDownloadExpiresAt ?? null,
  });
}

beforeAll(async () => {
  configureDocumentShareOrigin(TEST_ORIGIN);
  kit = await createTestKit();
  const companyA = kitIdentities.companies.a;
  const companyB = kitIdentities.companies.b;
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 60_000);

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

  await insertSeedDocument({
    id: fixtures.docA,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000901",
  });
  await insertSeedDocument({
    id: fixtures.docB,
    companyId: companyB,
    customerId: fixtures.customerB,
    productId: fixtures.productB,
    documentNumber: "MB-РХ-000901",
  });
  await insertSeedDocument({
    id: fixtures.docExpired,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000902",
  });
  await insertSeedDocument({
    id: fixtures.docRevoked,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000903",
  });
  await insertSeedDocument({
    id: fixtures.docPdfExpired,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000904",
  });
  await insertSeedDocument({
    id: fixtures.docSignedExpired,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000905",
  });
  await insertSeedDocument({
    id: fixtures.docSignedLive,
    companyId: companyA,
    customerId: fixtures.customerA,
    productId: fixtures.productA,
    documentNumber: "KA-РХ-000906",
  });

  const sharedA = await kit.invoke(shareDocument, {
    documentId: fixtures.docA,
  });
  const sharedB = await kit.invoke(
    shareDocument,
    { documentId: fixtures.docB },
    {
      userId: kitIdentities.users.boris,
      companyId: kitIdentities.companies.b,
    },
  );
  tokens.a = sharedA.token;
  tokens.b = sharedB.token;
  ownIsolationInput.token = sharedA.token;

  await insertTokenRow({
    documentId: fixtures.docExpired,
    companyId: companyA,
    token: expiredToken,
    expiresAt: past,
    revokedAt: null,
    pdfDownloadUrl: null,
    pdfDownloadExpiresAt: null,
  });
  await insertTokenRow({
    documentId: fixtures.docRevoked,
    companyId: companyA,
    token: revokedToken,
    expiresAt: future,
    revokedAt: past,
    pdfDownloadUrl: null,
    pdfDownloadExpiresAt: null,
  });
  await insertTokenRow({
    documentId: fixtures.docPdfExpired,
    companyId: companyA,
    token: pdfExpiredToken,
    expiresAt: future,
    revokedAt: null,
    pdfDownloadUrl: "https://files.example/expired.pdf",
    pdfDownloadExpiresAt: past,
  });
  await insertTokenRow({
    documentId: fixtures.docSignedExpired,
    companyId: companyA,
    token: signedExpiredToken,
    expiresAt: future,
    revokedAt: null,
    pdfDownloadUrl: "https://files.example/unsigned.pdf",
    pdfDownloadExpiresAt: future,
    signedDownloadUrl: "https://files.example/expired.asice",
    signedDownloadExpiresAt: past,
  });
  await insertTokenRow({
    documentId: fixtures.docSignedLive,
    companyId: companyA,
    token: signedLiveToken,
    expiresAt: future,
    revokedAt: null,
    pdfDownloadUrl: "https://files.example/unsigned.pdf",
    pdfDownloadExpiresAt: future,
    signedDownloadUrl: "https://files.example/live.asice",
    signedDownloadExpiresAt: future,
  });
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      getShared,
      { input: ownIsolationInput },
      { input: { token: "not-a-real-share-token" } },
    ),
  ],
);

describe("documents.getShared", () => {
  it("returns stored facts for a valid page token without creating CRM rows", async () => {
    const crmBefore = await readCrmSentinel(kit.db.runtime.db);
    const capturing = createCapturingLogger();
    const result = await kit.invoke(
      getShared,
      { token: tokens.a },
      {},
      { deps: { ...kit.pipeline, logger: capturing.logger } },
    );
    expect(result.documentId).toBe(fixtures.docA);
    expect(result.documentNumber).toBe("KA-РХ-000901");
    expect(result.pdfDownloadUrl).toBeNull();
    expect(result.signedDownloadUrl).toBeNull();
    expect(JSON.stringify(result)).not.toContain(fixtures.docB);
    expect(JSON.stringify(result)).not.toContain("Live CRM Name");
    expect(JSON.stringify(result)).not.toContain(tokens.a);

    const other = await kit.invoke(getShared, { token: tokens.b });
    expect(other.documentId).toBe(fixtures.docB);
    expect(other.documentNumber).toBe("MB-РХ-000901");
    expect(JSON.stringify(other)).not.toContain(fixtures.docA);

    const crmAfter = await readCrmSentinel(kit.db.runtime.db);
    expect(crmAfter).toEqual(crmBefore);

    const finished = capturing
      .entries()
      .find((line) => line["msg"] === "action finished");
    expect(finished?.["actor_type"]).toBe("anonymous");
    expect(finished).not.toHaveProperty("client_ip");
    expect(JSON.stringify(capturing.entries())).not.toContain(tokens.a);

    const auditRows = await kit.db.runtime.db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.action, "documents.getShared"));
    expect(auditRows).toEqual([]);
    const events = await kit.db.runtime.db
      .select({ name: domainEvents.name })
      .from(domainEvents)
      .where(eq(domainEvents.aggregateId, fixtures.docA));
    expect(events.map((row) => row.name)).not.toContain("documents.shared");
  });

  it("treats expired, revoked, and unknown tokens as the same not-found", async () => {
    const expired = await kit.invoke(getShared, { token: expiredToken }).then(
      () => {
        throw new Error("expected NotFoundError");
      },
      (error: unknown) => error,
    );
    const revoked = await kit.invoke(getShared, { token: revokedToken }).then(
      () => {
        throw new Error("expected NotFoundError");
      },
      (error: unknown) => error,
    );
    const unknown = await kit
      .invoke(getShared, { token: "totally-wrong-token" })
      .then(
        () => {
          throw new Error("expected NotFoundError");
        },
        (error: unknown) => error,
      );
    expect(expired).toBeInstanceOf(NotFoundError);
    expect(revoked).toBeInstanceOf(NotFoundError);
    expect(unknown).toBeInstanceOf(NotFoundError);
    if (
      expired instanceof NotFoundError &&
      revoked instanceof NotFoundError &&
      unknown instanceof NotFoundError
    ) {
      expect(expired.clientMessage).toBe(revoked.clientMessage);
      expect(revoked.clientMessage).toBe(unknown.clientMessage);
    }
  });

  it("returns null pdfDownloadUrl when the stored signature expired but the page token is valid", async () => {
    const result = await kit.invoke(getShared, { token: pdfExpiredToken });
    expect(result.documentId).toBe(fixtures.docPdfExpired);
    expect(result.pdfDownloadUrl).toBeNull();
    expect(result.signedDownloadUrl).toBeNull();
  });

  it("returns stored signedDownloadUrl beside the unsigned PDF and null when that signature expired", async () => {
    const live = await kit.invoke(getShared, { token: signedLiveToken });
    expect(live.documentId).toBe(fixtures.docSignedLive);
    expect(live.pdfDownloadUrl).toBe("https://files.example/unsigned.pdf");
    expect(live.signedDownloadUrl).toBe("https://files.example/live.asice");

    const expired = await kit.invoke(getShared, { token: signedExpiredToken });
    expect(expired.documentId).toBe(fixtures.docSignedExpired);
    expect(expired.pdfDownloadUrl).toBe("https://files.example/unsigned.pdf");
    expect(expired.signedDownloadUrl).toBeNull();
  });

  it("rejects an empty token", async () => {
    await expect(kit.invoke(getShared, { token: "" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("IP-HMAC rate-limits at the public default of 30/min", async () => {
    const policy = rateLimitDefaults.public;
    const logger = createCapturingLogger().logger;
    const deps = {
      ...kit.pipeline,
      logger,
      hooks: {
        ...kit.pipeline.hooks,
        rateLimit: createRateLimitHook({
          store: createInMemoryRateLimitStore({ now: () => FROZEN_NOW_MS }),
          ipHmacSecret: "test-kit-ip-hmac-secret",
          logger,
          now: () => FROZEN_NOW_MS,
        }),
      },
    };
    const clientIp = "198.51.100.20";
    for (let i = 0; i < policy.limit; i += 1) {
      await kit.invoke(getShared, { token: tokens.a }, { clientIp }, { deps });
    }
    await expect(
      kit.invoke(getShared, { token: tokens.a }, { clientIp }, { deps }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
