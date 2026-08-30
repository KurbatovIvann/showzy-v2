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
import { companyMembers } from "@showzy/db/schema/companies";
import { files } from "@showzy/db/schema/files";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  catalogObjectKey,
  documentObjectKey,
  signingObjectKey,
} from "../services/object-key.js";
import { getAttachmentFacts } from "./get-attachment-facts.js";
import { ATTACHMENT_FACTS_MAX_IDS } from "./get-attachment-facts.contract.js";

const fixtures = {
  readyA: randomUUID(),
  readyAPng: randomUUID(),
  pendingA: randomUUID(),
  readyB: randomUUID(),
  documentA: randomUUID(),
  signingA: randomUUID(),
};

const checksumA = "11".repeat(32);
const checksumAPng = "22".repeat(32);
const checksumB = "33".repeat(32);
const checksumPending = "44".repeat(32);
const checksumDocument = "55".repeat(32);
const checksumSigning = "66".repeat(32);

const clerkUserId = randomUUID();

let kit: TestKit;

async function insertFile(values: {
  id: string;
  companyId: string;
  status: "pending" | "ready";
  mimeType: "image/jpeg" | "image/png";
  byteSize: number;
  checksumSha256: string | null;
}): Promise<void> {
  await kit.db.runtime.db.insert(files).values({
    id: values.id,
    companyId: values.companyId,
    uploadedByUserId: kitIdentities.users.anna,
    purpose: "catalog",
    objectKey: catalogObjectKey(values.companyId, values.id),
    mimeType: values.mimeType,
    byteSize: BigInt(values.byteSize),
    checksumSha256: values.checksumSha256,
    status: values.status,
  });
}

beforeAll(async () => {
  kit = await createTestKit();

  await insertFile({
    id: fixtures.readyA,
    companyId: kitIdentities.companies.a,
    status: "ready",
    mimeType: "image/jpeg",
    byteSize: 128,
    checksumSha256: checksumA,
  });
  await insertFile({
    id: fixtures.readyAPng,
    companyId: kitIdentities.companies.a,
    status: "ready",
    mimeType: "image/png",
    byteSize: 256,
    checksumSha256: checksumAPng,
  });
  await insertFile({
    id: fixtures.pendingA,
    companyId: kitIdentities.companies.a,
    status: "pending",
    mimeType: "image/jpeg",
    byteSize: 64,
    checksumSha256: checksumPending,
  });
  await insertFile({
    id: fixtures.readyB,
    companyId: kitIdentities.companies.b,
    status: "ready",
    mimeType: "image/jpeg",
    byteSize: 128,
    checksumSha256: checksumB,
  });
  await kit.db.runtime.db.insert(files).values({
    id: fixtures.documentA,
    companyId: kitIdentities.companies.a,
    uploadedByUserId: null,
    purpose: "document",
    objectKey: documentObjectKey(kitIdentities.companies.a, fixtures.documentA),
    mimeType: "application/pdf",
    byteSize: 64n,
    checksumSha256: checksumDocument,
    status: "ready",
    stagingPurgedAt: new Date(),
  });
  await kit.db.runtime.db.insert(files).values({
    id: fixtures.signingA,
    companyId: kitIdentities.companies.a,
    uploadedByUserId: kitIdentities.users.anna,
    purpose: "signing",
    objectKey: signingObjectKey(kitIdentities.companies.a, fixtures.signingA),
    mimeType: "application/vnd.etsi.asic-e+zip",
    byteSize: 64n,
    checksumSha256: checksumSigning,
    status: "ready",
  });

  await kit.db.runtime.db.insert(user).values({
    id: clerkUserId,
    name: "Clerk",
    email: "clerk@files-facts-kit.test",
  });
  await kit.db.runtime.db.insert(companyMembers).values({
    companyId: kitIdentities.companies.a,
    userId: clerkUserId,
    role: "employee",
    permissions: { granted: [], denied: ["files:view"] },
  });
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      getAttachmentFacts,
      { input: { fileIds: [fixtures.readyA] } },
      { input: { fileIds: [fixtures.readyB] } },
    ),
  ],
);

describe("files.getAttachmentFacts", () => {
  it("returns ready in-company files in first-seen unique order", async () => {
    const result = await kit.invoke(getAttachmentFacts, {
      fileIds: [fixtures.readyAPng, fixtures.readyA, fixtures.readyAPng],
    });

    expect(result).toEqual({
      files: [
        {
          fileId: fixtures.readyAPng,
          status: "ready",
          purpose: "catalog",
          mimeType: "image/png",
          byteSize: 256,
          checksumSha256: checksumAPng,
        },
        {
          fileId: fixtures.readyA,
          status: "ready",
          purpose: "catalog",
          mimeType: "image/jpeg",
          byteSize: 128,
          checksumSha256: checksumA,
        },
      ],
    });
    expect(result.files.map((file) => file.fileId)).toEqual([
      fixtures.readyAPng,
      fixtures.readyA,
    ]);
  });

  it("omits object keys and URLs from the facts output", async () => {
    const result = await kit.invoke(getAttachmentFacts, {
      fileIds: [fixtures.readyA],
    });
    const blob = JSON.stringify(result);
    expect(blob).not.toContain("objectKey");
    expect(blob).not.toContain("object_key");
    expect(blob).not.toContain("/catalog/");
    expect(blob).not.toMatch(/https?:\/\//);
    expect(Object.keys(result.files[0] ?? {}).toSorted()).toEqual([
      "byteSize",
      "checksumSha256",
      "fileId",
      "mimeType",
      "purpose",
      "status",
    ]);
  });

  it("denies staff without files:view", async () => {
    await expect(
      kit.invoke(
        getAttachmentFacts,
        { fileIds: [fixtures.readyA] },
        { userId: clerkUserId, companyId: kitIdentities.companies.a },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an empty batch, oversized batch, and malformed ids", async () => {
    await expect(
      kit.invoke(getAttachmentFacts, { fileIds: [] }),
    ).rejects.toBeInstanceOf(ValidationError);

    const oversized = Array.from({ length: ATTACHMENT_FACTS_MAX_IDS + 1 }, () =>
      randomUUID(),
    );
    await expect(
      kit.invoke(getAttachmentFacts, { fileIds: oversized }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      kit.invoke(getAttachmentFacts, { fileIds: ["not-a-uuid"] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails the whole batch for a missing, pending, or foreign file with the same not-found", async () => {
    const missingId = randomUUID();
    const missingError = await kit
      .invoke(getAttachmentFacts, { fileIds: [missingId] })
      .then(
        () => {
          throw new Error("expected NotFoundError for a missing file");
        },
        (error: unknown) => error,
      );
    const pendingError = await kit
      .invoke(getAttachmentFacts, { fileIds: [fixtures.pendingA] })
      .then(
        () => {
          throw new Error("expected NotFoundError for a pending file");
        },
        (error: unknown) => error,
      );
    const foreignError = await kit
      .invoke(getAttachmentFacts, { fileIds: [fixtures.readyB] })
      .then(
        () => {
          throw new Error("expected NotFoundError for a foreign file");
        },
        (error: unknown) => error,
      );

    expect(missingError).toBeInstanceOf(NotFoundError);
    expect(pendingError).toBeInstanceOf(NotFoundError);
    expect(foreignError).toBeInstanceOf(NotFoundError);
    if (
      missingError instanceof NotFoundError &&
      pendingError instanceof NotFoundError &&
      foreignError instanceof NotFoundError
    ) {
      expect(missingError.clientMessage).toBe(pendingError.clientMessage);
      expect(pendingError.clientMessage).toBe(foreignError.clientMessage);
    }

    await expect(
      kit.invoke(getAttachmentFacts, {
        fileIds: [fixtures.readyA, missingId],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(getAttachmentFacts, {
        fileIds: [fixtures.readyA, fixtures.pendingA],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(getAttachmentFacts, {
        fileIds: [fixtures.readyA, fixtures.readyB],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const stillOwn = await kit.invoke(getAttachmentFacts, {
      fileIds: [fixtures.readyA],
    });
    expect(stillOwn.files).toHaveLength(1);
  });

  it("treats a generated document as not-found, not a catalog handshake error", async () => {
    await expect(
      kit.invoke(getAttachmentFacts, { fileIds: [fixtures.documentA] }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(getAttachmentFacts, {
        fileIds: [fixtures.readyA, fixtures.documentA],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("treats a signing object as not-found, not a catalog handshake error", async () => {
    await expect(
      kit.invoke(getAttachmentFacts, { fileIds: [fixtures.signingA] }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      kit.invoke(getAttachmentFacts, {
        fileIds: [fixtures.readyA, fixtures.signingA],
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
