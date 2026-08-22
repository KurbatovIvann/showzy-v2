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
import { auditLog } from "@showzy/db";
import { user } from "@showzy/db/schema/auth";
import { companyMembers } from "@showzy/db/schema/companies";
import { files } from "@showzy/db/schema/files";
import { and, count, eq } from "drizzle-orm";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { finalizeUpload } from "./finalize-upload.js";
import { getDownloadUrl } from "./get-download-url.js";
import { requestUpload } from "./request-upload.js";
import { sha256Hex } from "../services/checksum.js";
import { catalogObjectKey, stagingObjectKey } from "../services/object-key.js";
import {
  closeFilesObjectStore,
  configureFilesObjectStore,
  getFilesObjectStore,
} from "../services/s3-port.js";
import { MAX_UPLOAD_BYTES } from "../wire.contract.js";

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

async function countReadyFiles(companyId: string): Promise<number> {
  const rows = await requireKit()
    .db.runtime.db.select({ value: count() })
    .from(files)
    .where(and(eq(files.companyId, companyId), eq(files.status, "ready")));
  return rows[0]?.value ?? 0;
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
  await putSigned(requested.uploadUrl, bytes, mimeType);
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
  await putSigned(requested.uploadUrl, bytes, mimeType);
  return requested.fileId;
}

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
    expect(requested.fileId).toEqual(expect.any(String));
    expect(requested.uploadUrl.startsWith("http")).toBe(true);
    expect(requested.uploadUrl).toContain("/uploads/");
    expect(requested.uploadUrl).not.toContain("/catalog/");
    expect(requested.expiresAt).toEqual(expect.any(String));

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

    await putSigned(requested.uploadUrl, jpegBytes, "image/jpeg");
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
    expect(logs).not.toContain(requested.uploadUrl);
    expect(logs).not.toContain(rows[0]?.objectKey ?? "missing-key");
    expect(logs).not.toMatch(/\/catalog\//);
    expect(logs).not.toMatch(/\/uploads\//);
  });

  it("does not let a leftover signed PUT overwrite a ready catalog object", async () => {
    const requested = await requireKit().invoke(requestUpload, jpegInput);
    await putSigned(requested.uploadUrl, jpegBytes, "image/jpeg");
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

    await putSigned(requested.uploadUrl, leftoverBytes, "image/jpeg");

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
    await putSigned(exe.uploadUrl, exeBytes, "image/jpeg");
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: exe.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);

    const zip = await requireKit().invoke(requestUpload, {
      purpose: "catalog",
      mimeType: "image/png",
      byteSize: zipBytes.byteLength,
      checksumSha256: zipChecksum,
    });
    await putSigned(zip.uploadUrl, zipBytes, "image/png");
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: zip.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);

    const heic = await requireKit().invoke(requestUpload, {
      purpose: "catalog",
      mimeType: "image/jpeg",
      byteSize: heicBytes.byteLength,
      checksumSha256: heicAsJpegChecksum,
    });
    await putSigned(heic.uploadUrl, heicBytes, "image/jpeg");
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: heic.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("treats foreign and pending fileIds as not-found", async () => {
    const missing = randomUUID();
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: missing }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(getDownloadUrl, { fileId: missing }),
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

    const pending = await requireKit().invoke(requestUpload, jpegInput);
    await expect(
      requireKit().invoke(getDownloadUrl, { fileId: pending.fileId }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      requireKit().invoke(finalizeUpload, { fileId: pending.fileId }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("writes audit rows for the writes without URLs or object keys", async () => {
    const requested = await requireKit().invoke(requestUpload, jpegInput);
    await putSigned(requested.uploadUrl, jpegBytes, "image/jpeg");
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

    const blob = JSON.stringify([createAudit[0], finalizeAudit[0]]);
    expect(blob).not.toContain(requested.uploadUrl);
    expect(blob).not.toContain("/catalog/");
    expect(blob).not.toContain("/uploads/");
    expect(blob).not.toContain("objectKey");
    expect(blob).not.toContain("object_key");
  });
});
