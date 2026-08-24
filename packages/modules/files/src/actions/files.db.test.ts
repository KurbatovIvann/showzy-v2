import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from "@showzy/core/errors";
import {
  createCapturingLogger,
  createTestKit,
  crossTenantSuite,
  idempotencySuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { auditLog, idempotencyKeys } from "@showzy/db";
import { user } from "@showzy/db/schema/auth";
import { companyMembers } from "@showzy/db/schema/companies";
import { files } from "@showzy/db/schema/files";
import { and, count, eq, isNull } from "drizzle-orm";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { finalizeUpload } from "./finalize-upload.js";
import { getDownloadUrl } from "./get-download-url.js";
import { getUploadUrl } from "./get-upload-url.js";
import { requestUpload } from "./request-upload.js";
import { sweepAbandonedUploads } from "./sweep-abandoned-uploads.js";
import { ABANDONED_PENDING_TTL_MS } from "./sweep-abandoned-uploads.contract.js";
import { sha256Hex } from "../services/checksum.js";
import { catalogObjectKey, stagingObjectKey } from "../services/object-key.js";
import { SIGNED_PUT_SKEW_MARGIN_MS } from "../services/pending-abandon.js";
import {
  closeFilesObjectStore,
  configureFilesObjectStore,
  getFilesObjectStore,
  SIGNED_URL_TTL_SEC,
} from "../services/s3-port.js";
import { MAX_UPLOAD_BYTES, type FileMimeType } from "../wire.contract.js";

/** Same pin as docker-compose.yml (ADR-0027). */
const GARAGE_IMAGE = "dxflrs/garage:v2.3.0";
const GARAGE_BUCKET = "showzy";
const GARAGE_ACCESS_KEY = "showzy-local";
const GARAGE_SECRET_KEY = "showzy-local-secret";

const jpegBytes = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);
const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
]);
const exeBytes = Uint8Array.from([
  0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
]);
const zipBytes = Uint8Array.from([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
]);
const heicBytes = Uint8Array.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00,
  0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
]);

const jpegChecksum = sha256Hex(jpegBytes);
const pngChecksum = sha256Hex(pngBytes);
const exeChecksum = sha256Hex(exeBytes);
const zipChecksum = sha256Hex(zipBytes);
const heicAsJpegChecksum = sha256Hex(heicBytes);

const jpegInput = {
  purpose: "catalog" as const,
  mimeType: "image/jpeg" as const,
  byteSize: jpegBytes.byteLength,
  checksumSha256: jpegChecksum,
};

const clerks = {
  noUpload: randomUUID(),
  noView: randomUUID(),
};

const finalizeOwnInput = { fileId: "" };
const finalizeForeignInput = { fileId: "" };
const downloadOwnInput = { fileId: "" };
const downloadForeignInput = { fileId: "" };
const uploadOwnInput = { fileId: "" };
const uploadForeignInput = { fileId: "" };
const finalizeIdempotentInput = { fileId: "" };
const finalizeIdempotentFreshInput = { fileId: "" };

let kit: TestKit | undefined;
let garage: StartedTestContainer | undefined;

function requireKit(): TestKit {
  if (kit === undefined) {
    throw new Error("files test kit was not started");
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

async function putSigned(
  uploadUrl: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: bytes,
  });
  if (!response.ok) {
    throw new Error(`signed PUT failed: ${String(response.status)}`);
  }
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

async function countCompanyFiles(companyId: string): Promise<number> {
  const rows = await requireKit()
    .db.runtime.db.select({ value: count() })
    .from(files)
    .where(eq(files.companyId, companyId));
  return rows[0]?.value ?? 0;
}

async function countSweepAudits(): Promise<number> {
  const rows = await requireKit()
    .db.runtime.db.select({ value: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "files.sweepAbandonedUploads"),
        eq(auditLog.outcome, "ok"),
      ),
    );
  return rows[0]?.value ?? 0;
}

async function countReadyFiles(companyId: string): Promise<number> {
  const rows = await requireKit()
    .db.runtime.db.select({ value: count() })
    .from(files)
    .where(and(eq(files.companyId, companyId), eq(files.status, "ready")));
  return rows[0]?.value ?? 0;
}

async function countPendingFiles(companyId: string): Promise<number> {
  const rows = await requireKit()
    .db.runtime.db.select({ value: count() })
    .from(files)
    .where(and(eq(files.companyId, companyId), eq(files.status, "pending")));
  return rows[0]?.value ?? 0;
}

async function mintPut(
  fileId: string,
  actor: { readonly userId?: string; readonly companyId?: string } = {},
): Promise<{
  readonly fileId: string;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}> {
  return requireKit().invoke(getUploadUrl, { fileId }, actor);
}

async function requestPutFinalize(
  bytes: Uint8Array,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  actor: { readonly userId?: string; readonly companyId?: string } = {},
): Promise<{ readonly fileId: string; readonly checksumSha256: string }> {
  const requested = await requireKit().invoke(
    requestUpload,
    {
      purpose: "catalog",
      mimeType,
      byteSize: bytes.byteLength,
      checksumSha256: sha256Hex(bytes),
    },
    actor,
  );
  const signed = await mintPut(requested.fileId, actor);
  await putSigned(signed.uploadUrl, bytes, mimeType);
  const ready = await requireKit().invoke(
    finalizeUpload,
    { fileId: requested.fileId },
    actor,
  );
  return {
    fileId: ready.fileId,
    checksumSha256: ready.checksumSha256,
  };
}

async function requestAndPut(
  bytes: Uint8Array,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  actor: { readonly userId?: string; readonly companyId?: string } = {},
): Promise<string> {
  const requested = await requireKit().invoke(
    requestUpload,
    {
      purpose: "catalog",
      mimeType,
      byteSize: bytes.byteLength,
      checksumSha256: sha256Hex(bytes),
    },
    actor,
  );
  const signed = await mintPut(requested.fileId, actor);
  await putSigned(signed.uploadUrl, bytes, mimeType);
  return requested.fileId;
}

async function insertFileRow(values: {
  readonly id: string;
  readonly companyId: string;
  readonly uploadedByUserId: string;
  readonly status: "pending" | "ready";
  readonly mimeType?: FileMimeType;
  readonly bytes?: Uint8Array;
  readonly checksumSha256?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}): Promise<void> {
  const mimeType = values.mimeType ?? "image/jpeg";
  const bytes = values.bytes ?? jpegBytes;
  await requireKit()
    .db.runtime.db.insert(files)
    .values({
      id: values.id,
      companyId: values.companyId,
      uploadedByUserId: values.uploadedByUserId,
      purpose: "catalog",
      objectKey: catalogObjectKey(values.companyId, values.id),
      mimeType,
      byteSize: BigInt(bytes.byteLength),
      checksumSha256: values.checksumSha256 ?? sha256Hex(bytes),
      status: values.status,
      ...(values.createdAt !== undefined
        ? { createdAt: values.createdAt }
        : {}),
      ...(values.updatedAt !== undefined
        ? { updatedAt: values.updatedAt }
        : {}),
    });
}

async function putStoreObject(
  key: string,
  bytes: Uint8Array = jpegBytes,
  mimeType: FileMimeType = "image/jpeg",
): Promise<void> {
  await getFilesObjectStore().putObject({
    key,
    mimeType,
    bytes,
  });
}

const sweepEpoch = new Date(0);

beforeAll(async () => {
  const garageToml = readFileSync(
    path.join(repoRoot(), "docker/garage/garage.toml"),
    "utf8",
  ).replaceAll("\r\n", "\n");
  // dxflrs/garage is distroless (no /bin/sh), so HostPortWaitStrategy never
  // sees the S3 port. Wait on the listen log and keep metadata on tmpfs.
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

  const endpoint = `http://127.0.0.1:${String(startedGarage.getMappedPort(3900))}`;
  configureFilesObjectStore({
    endpoint,
    region: "us-east-1",
    accessKeyId: GARAGE_ACCESS_KEY,
    secretAccessKey: GARAGE_SECRET_KEY,
    forcePathStyle: true,
    bucket: GARAGE_BUCKET,
  });
  await waitForBucket();

  kit = await createTestKit();

  await requireKit()
    .db.runtime.db.insert(user)
    .values([
      {
        id: clerks.noUpload,
        name: "No upload",
        email: "noupload@files-kit.test",
      },
      {
        id: clerks.noView,
        name: "No view",
        email: "noview@files-kit.test",
      },
    ]);
  await requireKit()
    .db.runtime.db.insert(companyMembers)
    .values([
      {
        companyId: kitIdentities.companies.a,
        userId: clerks.noUpload,
        role: "employee",
        permissions: { granted: [], denied: ["files:upload"] },
      },
      {
        companyId: kitIdentities.companies.a,
        userId: clerks.noView,
        role: "employee",
        permissions: { granted: [], denied: ["files:view"] },
      },
    ]);

  const companyB = {
    userId: kitIdentities.users.boris,
    companyId: kitIdentities.companies.b,
  };
  finalizeOwnInput.fileId = await requestAndPut(jpegBytes, "image/jpeg");
  finalizeForeignInput.fileId = await requestAndPut(
    jpegBytes,
    "image/jpeg",
    companyB,
  );
  downloadOwnInput.fileId = (
    await requestPutFinalize(jpegBytes, "image/jpeg")
  ).fileId;
  downloadForeignInput.fileId = (
    await requestPutFinalize(jpegBytes, "image/jpeg", companyB)
  ).fileId;
  uploadOwnInput.fileId = (
    await requireKit().invoke(requestUpload, jpegInput)
  ).fileId;
  uploadForeignInput.fileId = (
    await requireKit().invoke(requestUpload, jpegInput, companyB)
  ).fileId;
  finalizeIdempotentInput.fileId = await requestAndPut(jpegBytes, "image/jpeg");
  finalizeIdempotentFreshInput.fileId = await requestAndPut(
    jpegBytes,
    "image/jpeg",
  );
});

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
    requestUpload,
    { input: jpegInput },
    { input: jpegInput, companyId: kitIdentities.companies.b },
  ),
  isolationCase(
    finalizeUpload,
    { input: finalizeOwnInput },
    { input: finalizeForeignInput },
  ),
  isolationCase(
    getDownloadUrl,
    { input: downloadOwnInput },
    { input: downloadForeignInput },
  ),
  isolationCase(
    getUploadUrl,
    { input: uploadOwnInput },
    { input: uploadForeignInput },
  ),
  isolationCase(sweepAbandonedUploads, { input: {} }, { input: {} }),
]);

idempotencySuite(requireKit, [
  {
    action: requestUpload,
    input: jpegInput,
    conflictingInput: {
      ...jpegInput,
      mimeType: "image/png",
      byteSize: pngBytes.byteLength,
      checksumSha256: pngChecksum,
    },
    readEffect: () => countCompanyFiles(kitIdentities.companies.a),
  },
  {
    action: finalizeUpload,
    input: finalizeIdempotentInput,
    conflictingInput: finalizeForeignInput,
    freshInput: () => finalizeIdempotentFreshInput,
    readEffect: () => countReadyFiles(kitIdentities.companies.a),
  },
  {
    action: sweepAbandonedUploads,
    input: {},
    conflictingInput: { limit: 1 },
    readEffect: () => countSweepAudits(),
  },
]);

describe("files signed upload slice", () => {
  it("uploads through a signed PUT, finalizes, and downloads the same bytes", async () => {
    const capturing = createCapturingLogger();
    const sneaky: unknown = {
      ...jpegInput,
      objectKey: "client-supplied/catalog/evil",
      companyId: kitIdentities.companies.b,
    };
    const requested = await requireKit().invoke(
      requestUpload,
      sneaky,
      {},
      { deps: { ...requireKit().pipeline, logger: capturing.logger } },
    );
    expect(requested).toEqual({ fileId: requested.fileId });
    expect(requested).not.toHaveProperty("uploadUrl");

    const rows = await requireKit()
      .db.runtime.db.select()
      .from(files)
      .where(eq(files.id, requested.fileId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("pending");
    expect(rows[0]?.objectKey).toBe(
      catalogObjectKey(kitIdentities.companies.a, requested.fileId),
    );
    expect(rows[0]?.objectKey).toBe(
      `${kitIdentities.companies.a}/catalog/${requested.fileId}`,
    );

    const signed = await requireKit().invoke(
      getUploadUrl,
      { fileId: requested.fileId },
      {},
      { deps: { ...requireKit().pipeline, logger: capturing.logger } },
    );
    expect(signed.fileId).toBe(requested.fileId);
    expect(signed.uploadUrl.startsWith("http")).toBe(true);
    expect(signed.uploadUrl).toContain("/uploads/");
    expect(signed.uploadUrl).not.toContain("/catalog/");
    expect(signed.expiresAt).toEqual(expect.any(String));

    await putSigned(signed.uploadUrl, jpegBytes, "image/jpeg");
    const store = getFilesObjectStore();
    expect(
      await store.getObject(
        catalogObjectKey(kitIdentities.companies.a, requested.fileId),
      ),
    ).toBe("missing");
    const staged = await store.getObject(
      stagingObjectKey(kitIdentities.companies.a, requested.fileId),
    );
    expect(staged).not.toBe("missing");
    if (staged === "missing") {
      throw new Error("expected staging object after signed PUT");
    }
    expect(sha256Hex(staged.bytes)).toBe(jpegChecksum);

    const ready = await requireKit().invoke(
      finalizeUpload,
      { fileId: requested.fileId },
      {},
      { deps: { ...requireKit().pipeline, logger: capturing.logger } },
    );
    expect(ready).toEqual({
      fileId: requested.fileId,
      status: "ready",
      purpose: "catalog",
      mimeType: "image/jpeg",
      byteSize: jpegBytes.byteLength,
      checksumSha256: jpegChecksum,
    });

    const again = await requireKit().invoke(finalizeUpload, {
      fileId: requested.fileId,
    });
    expect(again).toEqual(ready);

    const download = await requireKit().invoke(getDownloadUrl, {
      fileId: requested.fileId,
    });
    const fetched = await fetch(download.downloadUrl);
    expect(fetched.ok).toBe(true);
    const body = new Uint8Array(await fetched.arrayBuffer());
    expect(sha256Hex(body)).toBe(jpegChecksum);
    expect(fetched.headers.get("content-disposition")).toContain("attachment");

    const logs = JSON.stringify(capturing.entries());
    expect(logs).not.toContain(signed.uploadUrl);
    expect(logs).not.toContain(rows[0]?.objectKey ?? "missing-key");
    expect(logs).not.toMatch(/\/catalog\//);
    expect(logs).not.toMatch(/\/uploads\//);
  });

  it("does not let a leftover signed PUT overwrite a ready catalog object", async () => {
    const requested = await requireKit().invoke(requestUpload, jpegInput);
    const signed = await mintPut(requested.fileId);
    await putSigned(signed.uploadUrl, jpegBytes, "image/jpeg");
    const ready = await requireKit().invoke(finalizeUpload, {
      fileId: requested.fileId,
    });
    expect(ready.checksumSha256).toBe(jpegChecksum);

    const leftoverBytes = Uint8Array.from(jpegBytes);
    const flipIndex = leftoverBytes.byteLength - 3;
    const originalByte = leftoverBytes.at(flipIndex);
    if (originalByte === undefined) {
      throw new Error("jpeg fixture is too short to mutate");
    }
    leftoverBytes[flipIndex] = originalByte ^ 0xff;
    expect(leftoverBytes.byteLength).toBe(jpegBytes.byteLength);
    const leftoverChecksum = sha256Hex(leftoverBytes);
    expect(leftoverChecksum).not.toBe(jpegChecksum);

    await putSigned(signed.uploadUrl, leftoverBytes, "image/jpeg");

    const store = getFilesObjectStore();
    const catalog = await store.getObject(
      catalogObjectKey(kitIdentities.companies.a, requested.fileId),
    );
    expect(catalog).not.toBe("missing");
    if (catalog === "missing") {
      throw new Error("expected catalog object after finalize");
    }
    expect(sha256Hex(catalog.bytes)).toBe(jpegChecksum);

    const staging = await store.getObject(
      stagingObjectKey(kitIdentities.companies.a, requested.fileId),
    );
    expect(staging).not.toBe("missing");
    if (staging === "missing") {
      throw new Error("expected staging object after leftover PUT");
    }
    expect(sha256Hex(staging.bytes)).toBe(leftoverChecksum);

    const again = await requireKit().invoke(finalizeUpload, {
      fileId: requested.fileId,
    });
    expect(again.checksumSha256).toBe(jpegChecksum);
    expect(again).toEqual(ready);

    const catalogAfterReplay = await store.getObject(
      catalogObjectKey(kitIdentities.companies.a, requested.fileId),
    );
    expect(catalogAfterReplay).not.toBe("missing");
    if (catalogAfterReplay === "missing") {
      throw new Error("expected catalog object after second finalize");
    }
    expect(sha256Hex(catalogAfterReplay.bytes)).toBe(jpegChecksum);

    const download = await requireKit().invoke(getDownloadUrl, {
      fileId: requested.fileId,
    });
    const fetched = await fetch(download.downloadUrl);
    expect(fetched.ok).toBe(true);
    const body = new Uint8Array(await fetched.arrayBuffer());
    expect(sha256Hex(body)).toBe(jpegChecksum);

    const rows = await requireKit()
      .db.runtime.db.select()
      .from(files)
      .where(eq(files.id, requested.fileId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ready");
    expect(rows[0]?.checksumSha256).toBe(jpegChecksum);
    expect(rows[0]?.objectKey).toBe(
      catalogObjectKey(kitIdentities.companies.a, requested.fileId),
    );
    expect(rows[0]?.objectKey).not.toContain("/uploads/");
  });

  it("denies staff without files:upload or files:view", async () => {
    const actorCompany = { companyId: kitIdentities.companies.a };
    await expect(
      requireKit().invoke(requestUpload, jpegInput, {
        ...actorCompany,
        userId: clerks.noUpload,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      requireKit().invoke(
        finalizeUpload,
        { fileId: downloadOwnInput.fileId },
        { ...actorCompany, userId: clerks.noUpload },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      requireKit().invoke(
        getDownloadUrl,
        { fileId: downloadOwnInput.fileId },
        { ...actorCompany, userId: clerks.noView },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      requireKit().invoke(
        getUploadUrl,
        { fileId: uploadOwnInput.fileId },
        { ...actorCompany, userId: clerks.noUpload },
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects oversize, wrong MIME, HEIC, executables, and archives", async () => {
    await expect(
      requireKit().invoke(requestUpload, {
        ...jpegInput,
        byteSize: MAX_UPLOAD_BYTES + 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      requireKit().invoke(requestUpload, {
        ...jpegInput,
        mimeType: "image/heic",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      requireKit().invoke(requestUpload, {
        ...jpegInput,
        purpose: "documents",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const exe = await requireKit().invoke(requestUpload, {
      purpose: "catalog",
      mimeType: "image/jpeg",
      byteSize: exeBytes.byteLength,
      checksumSha256: exeChecksum,
    });
    await putSigned(
      (await mintPut(exe.fileId)).uploadUrl,
      exeBytes,
      "image/jpeg",
    );
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: exe.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);

    const zip = await requireKit().invoke(requestUpload, {
      purpose: "catalog",
      mimeType: "image/png",
      byteSize: zipBytes.byteLength,
      checksumSha256: zipChecksum,
    });
    await putSigned(
      (await mintPut(zip.fileId)).uploadUrl,
      zipBytes,
      "image/png",
    );
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: zip.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);

    const heic = await requireKit().invoke(requestUpload, {
      purpose: "catalog",
      mimeType: "image/jpeg",
      byteSize: heicBytes.byteLength,
      checksumSha256: heicAsJpegChecksum,
    });
    await putSigned(
      (await mintPut(heic.fileId)).uploadUrl,
      heicBytes,
      "image/jpeg",
    );
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: heic.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("treats foreign, missing, and ready fileIds as not-found on getUploadUrl", async () => {
    const missing = randomUUID();
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: missing }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(getDownloadUrl, { fileId: missing }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(getUploadUrl, { fileId: missing }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(finalizeUpload, {
        fileId: finalizeForeignInput.fileId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(getDownloadUrl, {
        fileId: finalizeForeignInput.fileId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(getDownloadUrl, {
        fileId: downloadForeignInput.fileId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(getUploadUrl, {
        fileId: uploadForeignInput.fileId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(getUploadUrl, {
        fileId: downloadOwnInput.fileId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const pending = await requireKit().invoke(requestUpload, jpegInput);
    await expect(
      requireKit().invoke(getDownloadUrl, { fileId: pending.fileId }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: pending.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("replays requestUpload as the same fileId without a second pending row or a stored URL", async () => {
    const key = randomUUID();
    const first = await requireKit().invoke(
      requestUpload,
      jpegInput,
      {},
      {
        request: { idempotencyKey: key },
      },
    );
    const replay = await requireKit().invoke(
      requestUpload,
      jpegInput,
      {},
      {
        request: { idempotencyKey: key },
      },
    );
    expect(first).toEqual({ fileId: first.fileId });
    expect(replay).toEqual(first);

    const fileRows = await requireKit()
      .db.runtime.db.select()
      .from(files)
      .where(eq(files.id, first.fileId));
    expect(fileRows).toHaveLength(1);
    expect(fileRows[0]?.status).toBe("pending");

    const reservations = await requireKit()
      .db.runtime.db.select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.action, "files.requestUpload"),
          eq(idempotencyKeys.key, key),
        ),
      );
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.response).toEqual({ fileId: first.fileId });
    const snapshot = JSON.stringify(reservations[0]?.response);
    expect(snapshot).not.toContain("uploadUrl");
    expect(snapshot).not.toContain("/catalog/");
    expect(snapshot).not.toContain("/uploads/");
    expect(snapshot).not.toContain("objectKey");
    expect(snapshot).not.toContain("http");
  });

  it("mints a live PUT again without a new pending row", async () => {
    const requested = await requireKit().invoke(requestUpload, jpegInput);
    const pendingBefore = await countPendingFiles(kitIdentities.companies.a);
    const first = await mintPut(requested.fileId);
    const second = await mintPut(requested.fileId);
    expect(second.fileId).toBe(requested.fileId);
    expect(first.uploadUrl.startsWith("http")).toBe(true);
    expect(second.uploadUrl.startsWith("http")).toBe(true);
    expect(second.uploadUrl).toContain("/uploads/");
    expect(await countPendingFiles(kitIdentities.companies.a)).toBe(
      pendingBefore,
    );

    const fileRows = await requireKit()
      .db.runtime.db.select()
      .from(files)
      .where(eq(files.id, requested.fileId));
    expect(fileRows).toHaveLength(1);
    expect(fileRows[0]?.status).toBe("pending");

    await putSigned(second.uploadUrl, jpegBytes, "image/jpeg");
    const ready = await requireKit().invoke(finalizeUpload, {
      fileId: requested.fileId,
    });
    expect(ready.checksumSha256).toBe(jpegChecksum);

    const reservations = await requireKit()
      .db.runtime.db.select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.action, "files.getUploadUrl"));
    expect(reservations).toHaveLength(0);
  });

  it("mints a PUT for a pending file younger than the remint cutoff without logging the URL", async () => {
    const fileId = randomUUID();
    const createdAt = new Date(Date.now() - 20 * 60 * 1000);
    await insertFileRow({
      id: fileId,
      companyId: kitIdentities.companies.a,
      uploadedByUserId: kitIdentities.users.anna,
      status: "pending",
      createdAt,
    });

    const capturing = createCapturingLogger();
    const signed = await requireKit().invoke(
      getUploadUrl,
      { fileId },
      {},
      { deps: { ...requireKit().pipeline, logger: capturing.logger } },
    );
    expect(signed.fileId).toBe(fileId);
    expect(signed.uploadUrl.startsWith("http")).toBe(true);
    expect(signed.uploadUrl).toContain("/uploads/");
    const logs = JSON.stringify(capturing.entries());
    expect(logs).not.toContain(signed.uploadUrl);
    expect(logs).not.toContain(
      catalogObjectKey(kitIdentities.companies.a, fileId),
    );
    expect(logs).not.toMatch(/\/catalog\//);
    expect(logs).not.toMatch(/\/uploads\//);
  });

  it("refuses getUploadUrl when the PUT would outlive the pending row", async () => {
    const fileId = randomUUID();
    const remainingMs =
      SIGNED_URL_TTL_SEC * 1000 - SIGNED_PUT_SKEW_MARGIN_MS - 1_000;
    const createdAt = new Date(
      Date.now() - (ABANDONED_PENDING_TTL_MS - remainingMs),
    );
    await insertFileRow({
      id: fileId,
      companyId: kitIdentities.companies.a,
      uploadedByUserId: kitIdentities.users.anna,
      status: "pending",
      createdAt,
    });
    await putStoreObject(stagingObjectKey(kitIdentities.companies.a, fileId));

    const capturing = createCapturingLogger();
    await expect(
      requireKit().invoke(
        getUploadUrl,
        { fileId },
        {},
        { deps: { ...requireKit().pipeline, logger: capturing.logger } },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(
        getUploadUrl,
        { fileId },
        {
          userId: kitIdentities.users.boris,
          companyId: kitIdentities.companies.b,
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    const logs = JSON.stringify(capturing.entries());
    expect(logs).not.toMatch(/\/catalog\//);
    expect(logs).not.toMatch(/\/uploads\//);

    await requireKit().invoke(sweepAbandonedUploads, {});
    const stillPending = await requireKit()
      .db.runtime.db.select({ id: files.id, status: files.status })
      .from(files)
      .where(eq(files.id, fileId));
    expect(stillPending).toEqual([{ id: fileId, status: "pending" }]);
    expect(
      await getFilesObjectStore().headObject(
        stagingObjectKey(kitIdentities.companies.a, fileId),
      ),
    ).not.toBe("missing");

    await requireKit()
      .db.runtime.db.update(files)
      .set({
        createdAt: new Date(Date.now() - ABANDONED_PENDING_TTL_MS - 1_000),
      })
      .where(eq(files.id, fileId));

    const swept = await requireKit().invoke(sweepAbandonedUploads, {});
    expect(swept.abandonedPendingDeleted).toBeGreaterThanOrEqual(1);
    const gone = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.id, fileId));
    expect(gone).toHaveLength(0);
    expect(
      await getFilesObjectStore().headObject(
        stagingObjectKey(kitIdentities.companies.a, fileId),
      ),
    ).toBe("missing");
  });

  it("writes audit rows for the writes without URLs or object keys", async () => {
    const requested = await requireKit().invoke(requestUpload, jpegInput);
    const signed = await mintPut(requested.fileId);
    await putSigned(signed.uploadUrl, jpegBytes, "image/jpeg");
    await requireKit().invoke(finalizeUpload, { fileId: requested.fileId });

    const createAudit = await requireKit()
      .db.runtime.db.select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "files.requestUpload"),
          eq(auditLog.targetId, requested.fileId),
        ),
      );
    expect(createAudit.length).toBeGreaterThanOrEqual(1);
    expect(createAudit[0]?.inputSnapshot).toBeNull();
    expect(createAudit[0]?.targetType).toBe("file");

    const finalizeAudit = await requireKit()
      .db.runtime.db.select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "files.finalizeUpload"),
          eq(auditLog.targetId, requested.fileId),
        ),
      );
    expect(finalizeAudit.length).toBeGreaterThanOrEqual(1);
    expect(finalizeAudit[0]?.inputSnapshot).toBeNull();

    const uploadAudit = await requireKit()
      .db.runtime.db.select()
      .from(auditLog)
      .where(eq(auditLog.action, "files.getUploadUrl"));
    expect(uploadAudit).toHaveLength(0);

    const blob = JSON.stringify([createAudit[0], finalizeAudit[0]]);
    expect(blob).not.toContain(signed.uploadUrl);
    expect(blob).not.toContain("/catalog/");
    expect(blob).not.toContain("/uploads/");
    expect(blob).not.toContain("objectKey");
    expect(blob).not.toContain("object_key");
  });
});

describe("files.sweepAbandonedUploads", () => {
  async function ageReadyRows(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      await requireKit()
        .db.runtime.db.update(files)
        .set({ updatedAt: sweepEpoch })
        .where(eq(files.id, id));
    }
  }

  async function drainAbandonedPending(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await requireKit().invoke(sweepAbandonedUploads, {});
      if (result.abandonedPendingDeleted === 0) {
        return;
      }
    }
    throw new Error("abandoned pending drain did not empty the batch");
  }

  async function countUnpurgedReady(): Promise<number> {
    const rows = await requireKit()
      .db.runtime.db.select({ value: count() })
      .from(files)
      .where(and(eq(files.status, "ready"), isNull(files.stagingPurgedAt)));
    return rows[0]?.value ?? 0;
  }

  async function drainUnpurgedReady(): Promise<void> {
    await drainAbandonedPending();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await countUnpurgedReady()) === 0) {
        return;
      }
      await requireKit().invoke(sweepAbandonedUploads, {});
    }
    throw new Error("ready leftover drain did not empty the batch");
  }

  async function fileCursor(id: string): Promise<{
    readonly stagingPurgedAt: Date | null;
    readonly updatedAt: Date;
  }> {
    const rows = await requireKit()
      .db.runtime.db.select({
        stagingPurgedAt: files.stagingPurgedAt,
        updatedAt: files.updatedAt,
      })
      .from(files)
      .where(eq(files.id, id));
    const row = rows[0];
    if (row === undefined) {
      throw new Error(`expected file row ${id}`);
    }
    return row;
  }

  it("leaves in-flight pending objects and the row in place", async () => {
    const fileId = await requestAndPut(jpegBytes, "image/jpeg");
    await putStoreObject(catalogObjectKey(kitIdentities.companies.a, fileId));

    await requireKit().invoke(sweepAbandonedUploads, {});

    const store = getFilesObjectStore();
    expect(
      await store.headObject(
        stagingObjectKey(kitIdentities.companies.a, fileId),
      ),
    ).not.toBe("missing");
    expect(
      await store.headObject(
        catalogObjectKey(kitIdentities.companies.a, fileId),
      ),
    ).not.toBe("missing");
    const rows = await requireKit()
      .db.runtime.db.select({ status: files.status })
      .from(files)
      .where(eq(files.id, fileId));
    expect(rows[0]?.status).toBe("pending");
  });

  it("discovers leftover staging on ready files in both companies without touching catalog bytes", async () => {
    await drainUnpurgedReady();
    const requestedA = await requireKit().invoke(requestUpload, jpegInput);
    const signedA = await mintPut(requestedA.fileId);
    await putSigned(signedA.uploadUrl, jpegBytes, "image/jpeg");
    const readyA = await requireKit().invoke(finalizeUpload, {
      fileId: requestedA.fileId,
    });
    const leftoverA = Uint8Array.from(jpegBytes);
    leftoverA[leftoverA.byteLength - 3] =
      (leftoverA.at(leftoverA.byteLength - 3) ?? 0) ^ 0xff;
    await putSigned(signedA.uploadUrl, leftoverA, "image/jpeg");

    const readyB = await requestPutFinalize(pngBytes, "image/png", {
      userId: kitIdentities.users.boris,
      companyId: kitIdentities.companies.b,
    });
    await putStoreObject(
      stagingObjectKey(kitIdentities.companies.b, readyB.fileId),
      pngBytes,
      "image/png",
    );
    await ageReadyRows([readyA.fileId, readyB.fileId]);

    const capturing = createCapturingLogger();
    const result = await requireKit().invoke(
      sweepAbandonedUploads,
      {},
      {},
      { deps: { ...requireKit().pipeline, logger: capturing.logger } },
    );
    expect(result.leftoverStagingDeleted).toBe(2);

    const store = getFilesObjectStore();
    expect(
      await store.headObject(
        stagingObjectKey(kitIdentities.companies.a, readyA.fileId),
      ),
    ).toBe("missing");
    expect(
      await store.headObject(
        stagingObjectKey(kitIdentities.companies.b, readyB.fileId),
      ),
    ).toBe("missing");
    const catalogA = await store.getObject(
      catalogObjectKey(kitIdentities.companies.a, readyA.fileId),
    );
    const catalogB = await store.getObject(
      catalogObjectKey(kitIdentities.companies.b, readyB.fileId),
    );
    expect(catalogA).not.toBe("missing");
    expect(catalogB).not.toBe("missing");
    if (catalogA === "missing" || catalogB === "missing") {
      throw new Error("expected catalog objects after staging sweep");
    }
    expect(sha256Hex(catalogA.bytes)).toBe(jpegChecksum);
    expect(sha256Hex(catalogB.bytes)).toBe(pngChecksum);
    expect((await fileCursor(readyA.fileId)).stagingPurgedAt).not.toBeNull();
    expect((await fileCursor(readyB.fileId)).stagingPurgedAt).not.toBeNull();

    const download = await requireKit().invoke(getDownloadUrl, {
      fileId: readyA.fileId,
    });
    const fetched = await fetch(download.downloadUrl);
    expect(fetched.ok).toBe(true);
    expect(sha256Hex(new Uint8Array(await fetched.arrayBuffer()))).toBe(
      jpegChecksum,
    );

    const logs = JSON.stringify(capturing.entries());
    expect(logs).not.toContain(signedA.uploadUrl);
    expect(logs).not.toMatch(/\/catalog\//);
    expect(logs).not.toMatch(/\/uploads\//);
  });

  it("discovers abandoned pending in both companies and deletes staging, catalog, and the row", async () => {
    await drainAbandonedPending();
    const fileId = randomUUID();
    const foreignId = randomUUID();
    const abandonedAt = new Date(Date.now() - ABANDONED_PENDING_TTL_MS - 1_000);
    await insertFileRow({
      id: fileId,
      companyId: kitIdentities.companies.a,
      uploadedByUserId: kitIdentities.users.anna,
      status: "pending",
      createdAt: abandonedAt,
    });
    await insertFileRow({
      id: foreignId,
      companyId: kitIdentities.companies.b,
      uploadedByUserId: kitIdentities.users.boris,
      status: "pending",
      createdAt: abandonedAt,
    });
    await putStoreObject(stagingObjectKey(kitIdentities.companies.a, fileId));
    await putStoreObject(catalogObjectKey(kitIdentities.companies.a, fileId));
    await putStoreObject(
      stagingObjectKey(kitIdentities.companies.b, foreignId),
    );
    await putStoreObject(
      catalogObjectKey(kitIdentities.companies.b, foreignId),
    );

    const capturing = createCapturingLogger();
    const requestId = randomUUID();
    const result = await requireKit().invoke(
      sweepAbandonedUploads,
      {},
      {},
      {
        deps: { ...requireKit().pipeline, logger: capturing.logger },
        request: { requestId },
      },
    );
    expect(result.abandonedPendingDeleted).toBeGreaterThanOrEqual(2);

    const store = getFilesObjectStore();
    expect(
      await store.headObject(
        stagingObjectKey(kitIdentities.companies.a, fileId),
      ),
    ).toBe("missing");
    expect(
      await store.headObject(
        catalogObjectKey(kitIdentities.companies.a, fileId),
      ),
    ).toBe("missing");
    expect(
      await store.headObject(
        stagingObjectKey(kitIdentities.companies.b, foreignId),
      ),
    ).toBe("missing");
    expect(
      await store.headObject(
        catalogObjectKey(kitIdentities.companies.b, foreignId),
      ),
    ).toBe("missing");

    const remaining = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.id, fileId));
    expect(remaining).toHaveLength(0);
    const foreign = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.id, foreignId));
    expect(foreign).toHaveLength(0);

    const audit = await requireKit()
      .db.runtime.db.select()
      .from(auditLog)
      .where(eq(auditLog.requestId, requestId));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.companyId).toBeNull();
    expect(audit[0]?.targetType).toBe("files_sweep");
    expect(audit[0]?.targetId).toBe(requestId);
    const blob = JSON.stringify([result, capturing.entries(), audit[0]]);
    expect(blob).not.toMatch(/\/catalog\//);
    expect(blob).not.toMatch(/\/uploads\//);
    expect(blob).not.toContain("objectKey");
  });

  it("keeps a ready catalog intact when the same tick deletes another tenant's abandoned objects", async () => {
    await drainAbandonedPending();
    const readyId = randomUUID();
    const abandonedId = randomUUID();
    const abandonedAt = new Date(Date.now() - ABANDONED_PENDING_TTL_MS - 1_000);
    await insertFileRow({
      id: readyId,
      companyId: kitIdentities.companies.b,
      uploadedByUserId: kitIdentities.users.boris,
      status: "ready",
      mimeType: "image/png",
      bytes: pngBytes,
      updatedAt: sweepEpoch,
    });
    await putStoreObject(
      catalogObjectKey(kitIdentities.companies.b, readyId),
      pngBytes,
      "image/png",
    );
    await insertFileRow({
      id: abandonedId,
      companyId: kitIdentities.companies.a,
      uploadedByUserId: kitIdentities.users.anna,
      status: "pending",
      createdAt: abandonedAt,
    });
    await putStoreObject(
      stagingObjectKey(kitIdentities.companies.a, abandonedId),
    );
    await putStoreObject(
      catalogObjectKey(kitIdentities.companies.a, abandonedId),
    );

    await requireKit().invoke(sweepAbandonedUploads, {});

    const catalog = await getFilesObjectStore().getObject(
      catalogObjectKey(kitIdentities.companies.b, readyId),
    );
    expect(catalog).not.toBe("missing");
    if (catalog === "missing") {
      throw new Error("expected company B catalog to survive company A GC");
    }
    expect(sha256Hex(catalog.bytes)).toBe(pngChecksum);
    const abandoned = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.id, abandonedId));
    expect(abandoned).toHaveLength(0);
  });

  it("bounds the batch and a later tick finishes the remainder", async () => {
    await drainAbandonedPending();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const wanted = new Set<string>(ids);
    const abandonedAt = new Date(Date.now() - ABANDONED_PENDING_TTL_MS - 1_000);
    for (const id of ids) {
      await insertFileRow({
        id,
        companyId: kitIdentities.companies.a,
        uploadedByUserId: kitIdentities.users.anna,
        status: "pending",
        createdAt: abandonedAt,
      });
    }

    const first = await requireKit().invoke(sweepAbandonedUploads, {
      limit: 1,
    });
    expect(first).toEqual({
      leftoverStagingDeleted: 0,
      abandonedPendingDeleted: 1,
    });
    const afterFirst = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.status, "pending"));
    const remainingIds = afterFirst
      .map((row) => row.id)
      .filter((id) => wanted.has(id));
    expect(remainingIds).toHaveLength(2);

    const second = await requireKit().invoke(sweepAbandonedUploads, {
      limit: 2,
    });
    expect(second.abandonedPendingDeleted).toBeGreaterThanOrEqual(2);
    const afterSecond = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.status, "pending"));
    expect(
      afterSecond.map((row) => row.id).filter((id) => wanted.has(id)),
    ).toHaveLength(0);
  });

  it("marks a ready HEAD miss so a later tick skips the row", async () => {
    await drainUnpurgedReady();
    const cleanedId = randomUUID();
    const leftoverId = randomUUID();
    await insertFileRow({
      id: cleanedId,
      companyId: kitIdentities.companies.a,
      uploadedByUserId: kitIdentities.users.anna,
      status: "ready",
      updatedAt: sweepEpoch,
    });
    await putStoreObject(
      catalogObjectKey(kitIdentities.companies.a, cleanedId),
    );

    const capturing = createCapturingLogger();
    const first = await requireKit().invoke(
      sweepAbandonedUploads,
      { limit: 1 },
      {},
      { deps: { ...requireKit().pipeline, logger: capturing.logger } },
    );
    expect(first.leftoverStagingDeleted).toBe(0);
    const afterFirst = await fileCursor(cleanedId);
    expect(afterFirst.stagingPurgedAt).not.toBeNull();
    expect(
      await getFilesObjectStore().headObject(
        catalogObjectKey(kitIdentities.companies.a, cleanedId),
      ),
    ).not.toBe("missing");
    const logs = JSON.stringify(capturing.entries());
    expect(logs).not.toMatch(/\/catalog\//);
    expect(logs).not.toMatch(/\/uploads\//);

    await insertFileRow({
      id: leftoverId,
      companyId: kitIdentities.companies.a,
      uploadedByUserId: kitIdentities.users.anna,
      status: "ready",
      updatedAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await putStoreObject(
      catalogObjectKey(kitIdentities.companies.a, leftoverId),
    );
    await putStoreObject(
      stagingObjectKey(kitIdentities.companies.a, leftoverId),
    );

    const second = await requireKit().invoke(sweepAbandonedUploads, {
      limit: 1,
    });
    expect(second.leftoverStagingDeleted).toBe(1);
    const afterSecond = await fileCursor(cleanedId);
    expect(afterSecond.stagingPurgedAt?.getTime()).toBe(
      afterFirst.stagingPurgedAt?.getTime(),
    );
    expect(afterSecond.updatedAt.getTime()).toBe(
      afterFirst.updatedAt.getTime(),
    );
    expect(
      await getFilesObjectStore().headObject(
        stagingObjectKey(kitIdentities.companies.a, leftoverId),
      ),
    ).toBe("missing");
    expect(
      await getFilesObjectStore().headObject(
        catalogObjectKey(kitIdentities.companies.a, leftoverId),
      ),
    ).not.toBe("missing");
    expect((await fileCursor(leftoverId)).stagingPurgedAt).not.toBeNull();
  });

  it("replays the same idempotency key after deleting an abandoned row", async () => {
    await drainAbandonedPending();
    const id = randomUUID();
    await insertFileRow({
      id,
      companyId: kitIdentities.companies.a,
      uploadedByUserId: kitIdentities.users.anna,
      status: "pending",
      createdAt: new Date(Date.now() - ABANDONED_PENDING_TTL_MS - 1_000),
    });
    await putStoreObject(stagingObjectKey(kitIdentities.companies.a, id));

    const key = randomUUID();
    const first = await requireKit().invoke(
      sweepAbandonedUploads,
      { limit: 1 },
      {},
      { request: { idempotencyKey: key } },
    );
    expect(first).toEqual({
      leftoverStagingDeleted: 0,
      abandonedPendingDeleted: 1,
    });
    const replay = await requireKit().invoke(
      sweepAbandonedUploads,
      { limit: 1 },
      {},
      { request: { idempotencyKey: key } },
    );
    expect(replay).toEqual(first);
    const gone = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.id, id));
    expect(gone).toHaveLength(0);

    await requireKit().invoke(sweepAbandonedUploads, { limit: 1 });
    const stillGone = await requireKit()
      .db.runtime.db.select({ id: files.id })
      .from(files)
      .where(eq(files.id, id));
    expect(stillGone).toHaveLength(0);
  });

  it("rejects an out-of-range batch limit", async () => {
    await expect(
      requireKit().invoke(sweepAbandonedUploads, { limit: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      requireKit().invoke(sweepAbandonedUploads, { limit: 21 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
