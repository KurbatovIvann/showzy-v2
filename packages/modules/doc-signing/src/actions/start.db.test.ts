import { randomUUID } from "node:crypto";

import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
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
import { user } from "@showzy/db/schema/auth";
import { products } from "@showzy/db/schema/catalog";
import { companyMembers } from "@showzy/db/schema/companies";
import { companyCustomers } from "@showzy/db/schema/customers";
import { documentGenerationJobs } from "@showzy/db/schema/doc-generation";
import {
  signingRequests,
  signingSignatures,
} from "@showzy/db/schema/doc-signing";
import { documentItems, documents } from "@showzy/db/schema/documents";
import { files } from "@showzy/db/schema/files";
import { orderItems, orders } from "@showzy/db/schema/orders";
import { cancelDocument } from "@showzy/documents";
import {
  closeFilesObjectStore,
  configureFilesObjectStore,
} from "@showzy/files/storage";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SIGN_REQUEST_TTL_MS } from "./start.contract.js";
import {
  ALREADY_SIGNED_MESSAGE,
  CANCELLED_START_MESSAGE,
  GRANT_EXPIRED_MESSAGE,
  GRANT_MISSING_MESSAGE,
  PDF_NOT_READY_MESSAGE,
  startSigning,
} from "./start.js";

const payloadSha256 = "a".repeat(64);
const asicSha256 = "b".repeat(64);

const fixtures = {
  customerA: randomUUID(),
  customerB: randomUUID(),
  productA: randomUUID(),
  productB: randomUUID(),
  orderIsolationA: randomUUID(),
  orderIsolationB: randomUUID(),
  orderIdem: randomUUID(),
  orderConcurrent: randomUUID(),
  orderRace: randomUUID(),
  orderHappy: randomUUID(),
  orderReplay: randomUUID(),
  orderCancelled: randomUUID(),
  orderSigned: randomUUID(),
  orderPdfPending: randomUUID(),
  orderGrantMissing: randomUUID(),
  orderGrantExpired: randomUUID(),
  orderDeny: randomUUID(),
  itemIsolationA: randomUUID(),
  itemIsolationB: randomUUID(),
  itemIdem: randomUUID(),
  itemConcurrent: randomUUID(),
  itemRace: randomUUID(),
  itemHappy: randomUUID(),
  itemReplay: randomUUID(),
  itemCancelled: randomUUID(),
  itemSigned: randomUUID(),
  itemPdfPending: randomUUID(),
  itemGrantMissing: randomUUID(),
  itemGrantExpired: randomUUID(),
  itemDeny: randomUUID(),
  docIsolationA: randomUUID(),
  docIsolationB: randomUUID(),
  docIdem: randomUUID(),
  docConcurrent: randomUUID(),
  docRace: randomUUID(),
  docHappy: randomUUID(),
  docReplay: randomUUID(),
  docCancelled: randomUUID(),
  docSigned: randomUUID(),
  docPdfPending: randomUUID(),
  docGrantMissing: randomUUID(),
  docGrantExpired: randomUUID(),
  docDeny: randomUUID(),
  pdfIsolationA: randomUUID(),
  pdfIsolationB: randomUUID(),
  pdfIdem: randomUUID(),
  pdfConcurrent: randomUUID(),
  pdfRace: randomUUID(),
  pdfHappy: randomUUID(),
  pdfReplay: randomUUID(),
  pdfReplayAlt: randomUUID(),
  pdfCancelled: randomUUID(),
  pdfSigned: randomUUID(),
  pdfGrantMissing: randomUUID(),
  pdfGrantExpired: randomUUID(),
  pdfDeny: randomUUID(),
  asicSigned: randomUUID(),
  signatureSigned: randomUUID(),
};

const clerks = {
  employee: randomUUID(),
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

const buyerSnapshot = {
  kind: "customer" as const,
  displayName: "Fixture buyer",
};

let kit: TestKit;
const seedOrderNumbers = new Map<string, number>();

function nextSeedOrderNumber(companyId: string): string {
  const next = (seedOrderNumbers.get(companyId) ?? 0) + 1;
  seedOrderNumbers.set(companyId, next);
  return `T-${String(next)}`;
}

async function countPending(companyId: string): Promise<number> {
  const rows = await kit.db.runtime.db
    .select({ id: signingRequests.id })
    .from(signingRequests)
    .where(
      and(
        eq(signingRequests.companyId, companyId),
        eq(signingRequests.status, "pending"),
      ),
    );
  return rows.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForUngrantedLock(): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const result = await kit.db.admin.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM pg_locks WHERE NOT granted",
    );
    if ((result.rows[0]?.n ?? 0) > 0) {
      return;
    }
    await sleep(20);
  }
  throw new Error(
    "timed out waiting for start to wait on the document row lock",
  );
}

async function insertDocumentFile(
  id: string,
  companyId: string,
): Promise<void> {
  await kit.db.runtime.db.insert(files).values({
    id,
    companyId,
    purpose: "document",
    mimeType: "application/pdf",
    byteSize: 1024n,
    objectKey: `${companyId}/documents/${id}`,
    status: "ready",
    checksumSha256: payloadSha256,
    stagingPurgedAt: new Date("2026-08-30T00:00:00.000Z"),
  });
}

async function insertReadyJob(
  documentId: string,
  companyId: string,
  fileId: string,
): Promise<void> {
  await kit.db.runtime.db.insert(documentGenerationJobs).values({
    companyId,
    documentId,
    status: "ready",
    fileId,
  });
}

beforeAll(async () => {
  configureFilesObjectStore({
    endpoint: "http://127.0.0.1:3900",
    region: "us-east-1",
    accessKeyId: "showzy-local",
    secretAccessKey: "showzy-local-secret",
    forcePathStyle: true,
    bucket: "showzy",
  });
  kit = await createTestKit();
  const companyA = kitIdentities.companies.a;
  const companyB = kitIdentities.companies.b;
  const createdAt = new Date("2026-08-30T12:00:00.000Z");
  const grantedAt = new Date();
  const expiredAt = new Date(Date.now() - SIGN_REQUEST_TTL_MS - 60_000);

  await kit.db.runtime.db.insert(companyCustomers).values([
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

  const rows = [
    {
      documentId: fixtures.docIsolationA,
      orderId: fixtures.orderIsolationA,
      orderItemId: fixtures.itemIsolationA,
      companyId: companyA,
      number: "KA-РХ-000940",
      status: "issued" as const,
      pdfId: fixtures.pdfIsolationA,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docIsolationB,
      orderId: fixtures.orderIsolationB,
      orderItemId: fixtures.itemIsolationB,
      companyId: companyB,
      number: "MB-РХ-000940",
      status: "issued" as const,
      pdfId: fixtures.pdfIsolationB,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docIdem,
      orderId: fixtures.orderIdem,
      orderItemId: fixtures.itemIdem,
      companyId: companyA,
      number: "KA-РХ-000941",
      status: "issued" as const,
      pdfId: fixtures.pdfIdem,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docConcurrent,
      orderId: fixtures.orderConcurrent,
      orderItemId: fixtures.itemConcurrent,
      companyId: companyA,
      number: "KA-РХ-000942",
      status: "issued" as const,
      pdfId: fixtures.pdfConcurrent,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docRace,
      orderId: fixtures.orderRace,
      orderItemId: fixtures.itemRace,
      companyId: companyA,
      number: "KA-РХ-000951",
      status: "issued" as const,
      pdfId: fixtures.pdfRace,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docHappy,
      orderId: fixtures.orderHappy,
      orderItemId: fixtures.itemHappy,
      companyId: companyA,
      number: "KA-РХ-000943",
      status: "issued" as const,
      pdfId: fixtures.pdfHappy,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docReplay,
      orderId: fixtures.orderReplay,
      orderItemId: fixtures.itemReplay,
      companyId: companyA,
      number: "KA-РХ-000944",
      status: "issued" as const,
      pdfId: fixtures.pdfReplay,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docCancelled,
      orderId: fixtures.orderCancelled,
      orderItemId: fixtures.itemCancelled,
      companyId: companyA,
      number: "KA-РХ-000945",
      status: "cancelled" as const,
      pdfId: fixtures.pdfCancelled,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docSigned,
      orderId: fixtures.orderSigned,
      orderItemId: fixtures.itemSigned,
      companyId: companyA,
      number: "KA-РХ-000946",
      status: "issued" as const,
      pdfId: fixtures.pdfSigned,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docPdfPending,
      orderId: fixtures.orderPdfPending,
      orderItemId: fixtures.itemPdfPending,
      companyId: companyA,
      number: "KA-РХ-000947",
      status: "issued" as const,
      pdfId: null,
      grant: grantedAt,
    },
    {
      documentId: fixtures.docGrantMissing,
      orderId: fixtures.orderGrantMissing,
      orderItemId: fixtures.itemGrantMissing,
      companyId: companyA,
      number: "KA-РХ-000948",
      status: "issued" as const,
      pdfId: fixtures.pdfGrantMissing,
      grant: null,
    },
    {
      documentId: fixtures.docGrantExpired,
      orderId: fixtures.orderGrantExpired,
      orderItemId: fixtures.itemGrantExpired,
      companyId: companyA,
      number: "KA-РХ-000949",
      status: "issued" as const,
      pdfId: fixtures.pdfGrantExpired,
      grant: expiredAt,
    },
    {
      documentId: fixtures.docDeny,
      orderId: fixtures.orderDeny,
      orderItemId: fixtures.itemDeny,
      companyId: companyA,
      number: "KA-РХ-000950",
      status: "issued" as const,
      pdfId: fixtures.pdfDeny,
      grant: grantedAt,
    },
  ] as const;

  await kit.db.runtime.db.insert(orders).values(
    rows.map((row) => ({
      id: row.orderId,
      companyId: row.companyId,
      orderNumber: nextSeedOrderNumber(row.companyId),
      customerId:
        row.companyId === companyA ? fixtures.customerA : fixtures.customerB,
      customerNameSnapshot: "Fixture customer",
      status: "new" as const,
      totalNetMinor: 250n,
      totalTaxMinor: 0n,
      totalGrossMinor: 250n,
      currency: "UAH",
    })),
  );
  await kit.db.runtime.db.insert(orderItems).values(
    rows.map((row) => ({
      id: row.orderItemId,
      companyId: row.companyId,
      orderId: row.orderId,
      productId:
        row.companyId === companyA ? fixtures.productA : fixtures.productB,
      titleSnapshot: "Seed",
      quantityMilli: 1000n,
      unitPriceMinor: 250n,
      taxTreatment: "exempt" as const,
      netAmountMinor: 250n,
      grossAmountMinor: 250n,
      priceSource: "base" as const,
      resolverVersion: 1,
    })),
  );
  await kit.db.runtime.db.insert(documents).values(
    rows.map((row) => ({
      id: row.documentId,
      companyId: row.companyId,
      orderId: row.orderId,
      counterpartyId: null,
      type: "payment_invoice",
      status: row.status,
      documentNumber: row.number,
      issuedOn: "2026-08-30",
      supplierDetails: sellerSnapshot,
      buyerDetails: buyerSnapshot,
      totalNetMinor: 250n,
      totalTaxMinor: 0n,
      totalGrossMinor: 250n,
      currency: "UAH",
      templateSource: "system",
      templateName: "payment_invoice",
      signRequestedAt: row.grant,
      createdAt,
      updatedAt: createdAt,
    })),
  );
  await kit.db.runtime.db.insert(documentItems).values(
    rows.map((row) => ({
      id: row.orderItemId,
      companyId: row.companyId,
      documentId: row.documentId,
      productId:
        row.companyId === companyA ? fixtures.productA : fixtures.productB,
      titleSnapshot: "Line",
      quantityMilli: 1000n,
      unitPriceMinor: 250n,
      taxTreatment: "exempt",
      netAmountMinor: 250n,
      grossAmountMinor: 250n,
      currency: "UAH",
      createdAt,
    })),
  );

  for (const row of rows) {
    if (row.pdfId === null) {
      continue;
    }
    await insertDocumentFile(row.pdfId, row.companyId);
    await insertReadyJob(row.documentId, row.companyId, row.pdfId);
  }

  await kit.db.runtime.db.insert(files).values({
    id: fixtures.pdfReplayAlt,
    companyId: companyA,
    purpose: "document",
    mimeType: "application/pdf",
    byteSize: 1024n,
    objectKey: `${companyA}/documents/${fixtures.pdfReplayAlt}`,
    status: "ready",
    checksumSha256: "c".repeat(64),
    stagingPurgedAt: new Date("2026-08-30T00:00:00.000Z"),
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
    checksumSha256: asicSha256,
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
    id: clerks.employee,
    name: "Employee",
    email: "employee@doc-signing-start-kit.test",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: companyA,
    userId: clerks.employee,
    role: "employee",
    permissions: { granted: [], denied: [] },
  });
});

afterAll(async () => {
  closeFilesObjectStore();
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      startSigning,
      { input: { documentId: fixtures.docIsolationA } },
      { input: { documentId: fixtures.docIsolationB } },
    ),
  ],
);

describe("docSigning.start", () => {
  it("freezes the payload digest and returns a payload download URL", async () => {
    const requestId = randomUUID();
    const capturing = createCapturingLogger();
    const result = await kit.invoke(
      startSigning,
      { documentId: fixtures.docHappy },
      {},
      {
        request: { requestId },
        deps: { ...kit.pipeline, logger: capturing.logger },
      },
    );
    expect(result.documentId).toBe(fixtures.docHappy);
    expect(result.payloadFileId).toBe(fixtures.pdfHappy);
    expect(result.payloadSha256).toBe(payloadSha256);
    expect(result.payloadDigestAlgorithm).toBe("sha256");
    expect(result.payloadDownloadUrl.startsWith("http")).toBe(true);
    expect(result.payloadDownloadExpiresAt).toEqual(expect.any(String));
    expect(result.requestId).toEqual(expect.any(String));

    const stored = await kit.db.runtime.db
      .select({
        id: signingRequests.id,
        payloadSha256: signingRequests.payloadSha256,
        payloadFileId: signingRequests.payloadFileId,
        status: signingRequests.status,
      })
      .from(signingRequests)
      .where(eq(signingRequests.id, result.requestId));
    expect(stored).toEqual([
      {
        id: result.requestId,
        payloadSha256,
        payloadFileId: fixtures.pdfHappy,
        status: "pending",
      },
    ]);

    const audits = await kit.db.runtime.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.requestId, requestId));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "docSigning.start",
      companyId: kitIdentities.companies.a,
      actorType: "user",
      actorId: kitIdentities.users.anna,
      targetType: "document",
      targetId: fixtures.docHappy,
      outcome: "ok",
    });
    expect(JSON.stringify(audits[0])).not.toContain(result.payloadDownloadUrl);
    const logs = JSON.stringify(capturing.entries());
    expect(logs).not.toContain(result.payloadDownloadUrl);
    expect(logs).not.toMatch(/X-Amz-Signature/);
  });

  it("replays the same pending request id and frozen digest with a newly issued URL", async () => {
    const first = await kit.invoke(startSigning, {
      documentId: fixtures.docReplay,
    });
    await sleep(50);
    const second = await kit.invoke(startSigning, {
      documentId: fixtures.docReplay,
    });
    expect(second.requestId).toBe(first.requestId);
    expect(second.payloadSha256).toBe(first.payloadSha256);
    expect(second.payloadFileId).toBe(first.payloadFileId);
    expect(second.payloadFileId).toBe(fixtures.pdfReplay);
    expect(second.payloadDownloadUrl.startsWith("http")).toBe(true);
    expect(second.payloadDownloadUrl).toContain(fixtures.pdfReplay);
    expect(second.payloadDownloadExpiresAt).not.toBe(
      first.payloadDownloadExpiresAt,
    );
    expect(
      await kit.db.runtime.db
        .select({ id: signingRequests.id })
        .from(signingRequests)
        .where(
          and(
            eq(signingRequests.documentId, fixtures.docReplay),
            eq(signingRequests.status, "pending"),
          ),
        ),
    ).toHaveLength(1);
  });

  it("re-issues the pending URL for the stored payloadFileId, not the current generation file", async () => {
    const first = await kit.invoke(startSigning, {
      documentId: fixtures.docReplay,
    });
    await kit.db.runtime.db
      .update(documentGenerationJobs)
      .set({ fileId: fixtures.pdfReplayAlt })
      .where(eq(documentGenerationJobs.documentId, fixtures.docReplay));

    const second = await kit.invoke(startSigning, {
      documentId: fixtures.docReplay,
    });
    expect(second.requestId).toBe(first.requestId);
    expect(second.payloadFileId).toBe(fixtures.pdfReplay);
    expect(second.payloadSha256).toBe(payloadSha256);
    expect(second.payloadDownloadUrl).toContain(fixtures.pdfReplay);
    expect(second.payloadDownloadUrl).not.toContain(fixtures.pdfReplayAlt);
  });

  it("rejects a missing grant and an expired grant", async () => {
    const missing = await kit
      .invoke(startSigning, { documentId: fixtures.docGrantMissing })
      .catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(ValidationError);
    if (missing instanceof ValidationError) {
      expect(missing.clientMessage).toBe(GRANT_MISSING_MESSAGE);
    }

    const expired = await kit
      .invoke(startSigning, { documentId: fixtures.docGrantExpired })
      .catch((error: unknown) => error);
    expect(expired).toBeInstanceOf(ValidationError);
    if (expired instanceof ValidationError) {
      expect(expired.clientMessage).toBe(GRANT_EXPIRED_MESSAGE);
    }
  });

  it("rejects cancelled, PDF-not-ready, and already supplier-signed documents", async () => {
    await expect(
      kit.invoke(startSigning, { documentId: fixtures.docCancelled }),
    ).rejects.toBeInstanceOf(ConflictError);
    const cancelled = await kit
      .invoke(startSigning, { documentId: fixtures.docCancelled })
      .catch((error: unknown) => error);
    if (cancelled instanceof ConflictError) {
      expect(cancelled.clientMessage).toBe(CANCELLED_START_MESSAGE);
    }

    const pdfPending = await kit
      .invoke(startSigning, { documentId: fixtures.docPdfPending })
      .catch((error: unknown) => error);
    expect(pdfPending).toBeInstanceOf(ValidationError);
    if (pdfPending instanceof ValidationError) {
      expect(pdfPending.clientMessage).toBe(PDF_NOT_READY_MESSAGE);
    }

    const signed = await kit
      .invoke(startSigning, { documentId: fixtures.docSigned })
      .catch((error: unknown) => error);
    expect(signed).toBeInstanceOf(ConflictError);
    if (signed instanceof ConflictError) {
      expect(signed.clientMessage).toBe(ALREADY_SIGNED_MESSAGE);
    }
  });

  it("denies documents:edit and an employee with documents:view only", async () => {
    await expect(
      kit.invoke(
        startSigning,
        { documentId: fixtures.docDeny },
        {
          userId: clerks.employee,
          companyId: kitIdentities.companies.a,
        },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("returns the same not-found for missing and foreign documents", async () => {
    const missingId = randomUUID();
    const missingError = await kit
      .invoke(startSigning, { documentId: missingId })
      .catch((error: unknown) => error);
    const foreignError = await kit
      .invoke(startSigning, { documentId: fixtures.docIsolationB })
      .catch((error: unknown) => error);

    expect(missingError).toBeInstanceOf(NotFoundError);
    expect(foreignError).toBeInstanceOf(NotFoundError);
    if (
      missingError instanceof NotFoundError &&
      foreignError instanceof NotFoundError
    ) {
      expect(missingError.clientMessage).toBe(foreignError.clientMessage);
    }
  });

  it("rejects companyId on input", async () => {
    await expect(
      kit.invoke(startSigning, {
        documentId: fixtures.docHappy,
        companyId: kitIdentities.companies.a,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not leave a pending request when cancel commits while start waits on the row lock", async () => {
    let startPromise: Promise<unknown> | undefined;
    await kit.db.runtime.db.transaction(async (tx) => {
      const locked = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.companyId, kitIdentities.companies.a),
            eq(documents.id, fixtures.docRace),
          ),
        )
        .limit(1)
        .for("update");
      expect(locked).toHaveLength(1);

      startPromise = kit
        .invoke(startSigning, { documentId: fixtures.docRace })
        .catch((error: unknown) => error);
      await waitForUngrantedLock();

      await tx
        .update(documents)
        .set({ status: "cancelled", signRequestedAt: null })
        .where(
          and(
            eq(documents.companyId, kitIdentities.companies.a),
            eq(documents.id, fixtures.docRace),
          ),
        );
    });

    if (startPromise === undefined) {
      throw new Error("start was not invoked under the held document lock");
    }
    const started = await startPromise;
    expect(started).toBeInstanceOf(ConflictError);
    if (started instanceof ConflictError) {
      expect(started.clientMessage).toBe(CANCELLED_START_MESSAGE);
    }
    expect(
      await kit.db.runtime.db
        .select({ id: signingRequests.id })
        .from(signingRequests)
        .where(
          and(
            eq(signingRequests.documentId, fixtures.docRace),
            eq(signingRequests.status, "pending"),
          ),
        ),
    ).toHaveLength(0);
  });

  it("serializes concurrent start and cancel so a cancelled document cannot keep a live pending request after a failed start", async () => {
    const pendingBefore = await countPending(kitIdentities.companies.a);
    const results = await Promise.allSettled([
      kit.invoke(startSigning, { documentId: fixtures.docConcurrent }),
      kit.invoke(cancelDocument, { documentId: fixtures.docConcurrent }),
    ]);

    const header = await kit.db.runtime.db
      .select({
        status: documents.status,
        signRequestedAt: documents.signRequestedAt,
      })
      .from(documents)
      .where(eq(documents.id, fixtures.docConcurrent));
    expect(header).toEqual([{ status: "cancelled", signRequestedAt: null }]);

    const pending = await kit.db.runtime.db
      .select({ id: signingRequests.id })
      .from(signingRequests)
      .where(
        and(
          eq(signingRequests.documentId, fixtures.docConcurrent),
          eq(signingRequests.status, "pending"),
        ),
      );
    const startOutcome = results[0];
    if (startOutcome.status === "fulfilled") {
      expect(pending).toHaveLength(1);
    } else {
      expect(pending).toHaveLength(0);
      expect(startOutcome.reason).toBeInstanceOf(ConflictError);
    }
    expect(await countPending(kitIdentities.companies.a)).toBe(
      pendingBefore + pending.length,
    );
  });

  it("clears the HITL grant and emits documents.cancelled after start so abandonRequest still runs", async () => {
    const started = await kit.invoke(startSigning, {
      documentId: fixtures.docIdem,
    });
    await kit.invoke(cancelDocument, { documentId: fixtures.docIdem });

    const header = await kit.db.runtime.db
      .select({
        status: documents.status,
        signRequestedAt: documents.signRequestedAt,
      })
      .from(documents)
      .where(eq(documents.id, fixtures.docIdem));
    expect(header).toEqual([{ status: "cancelled", signRequestedAt: null }]);

    const events = await kit.db.runtime.db
      .select({ name: domainEvents.name })
      .from(domainEvents)
      .where(eq(domainEvents.aggregateId, fixtures.docIdem));
    expect(events.map((row) => row.name)).toContain("documents.cancelled");

    expect(
      await kit.db.runtime.db
        .select({ id: signingRequests.id, status: signingRequests.status })
        .from(signingRequests)
        .where(eq(signingRequests.id, started.requestId)),
    ).toEqual([{ id: started.requestId, status: "pending" }]);
  });
});
