import { CoreInvariantError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { SIGNING_MIME_TYPE } from "../wire.contract.js";
import {
  FILE_PURPOSE_PIPELINE,
  catalogFilePurpose,
  documentFilePurpose,
  signingFilePurpose,
} from "./file-purpose.js";
import {
  catalogObjectKey,
  documentObjectKey,
  signingObjectKey,
} from "./object-key.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";

describe("FILE_PURPOSE_PIPELINE", () => {
  it("is catalog, document, and signing — the next purpose is a table entry", () => {
    expect(Object.keys(FILE_PURPOSE_PIPELINE).toSorted()).toEqual([
      "catalog",
      "document",
      "signing",
    ]);
    expect(FILE_PURPOSE_PIPELINE.catalog).toBe(catalogFilePurpose);
    expect(FILE_PURPOSE_PIPELINE.document).toBe(documentFilePurpose);
    expect(FILE_PURPOSE_PIPELINE.signing).toBe(signingFilePurpose);
    expect(catalogFilePurpose.objectKey(companyId, fileId)).toBe(
      catalogObjectKey(companyId, fileId),
    );
    expect(documentFilePurpose.objectKey(companyId, fileId)).toBe(
      documentObjectKey(companyId, fileId),
    );
    expect(signingFilePurpose.objectKey(companyId, fileId)).toBe(
      signingObjectKey(companyId, fileId),
    );
    expect(catalogFilePurpose.viewSchema).toBeDefined();
    expect(documentFilePurpose.viewSchema).toBeDefined();
    expect(signingFilePurpose.viewSchema).toBeDefined();
  });

  it("keeps per-purpose MIME gates", () => {
    expect(catalogFilePurpose.requireMime("image/jpeg")).toBe("image/jpeg");
    expect(documentFilePurpose.requireMime("application/pdf")).toBe(
      "application/pdf",
    );
    expect(signingFilePurpose.requireMime(SIGNING_MIME_TYPE)).toBe(
      SIGNING_MIME_TYPE,
    );
    expect(() => catalogFilePurpose.requireMime("application/pdf")).toThrow(
      CoreInvariantError,
    );
    expect(() => documentFilePurpose.requireMime("image/jpeg")).toThrow(
      CoreInvariantError,
    );
    expect(() => signingFilePurpose.requireMime("application/pdf")).toThrow(
      CoreInvariantError,
    );
  });

  it("maps a ready row through the descriptor view", () => {
    const view = catalogFilePurpose.toReadyView({
      id: fileId,
      purpose: "catalog",
      mimeType: "image/png",
      byteSize: 12n,
      checksumSha256: "a".repeat(64),
      status: "ready",
    });
    expect(view).toEqual({
      fileId,
      status: "ready",
      purpose: "catalog",
      mimeType: "image/png",
      byteSize: 12,
      checksumSha256: "a".repeat(64),
    });
  });
});
