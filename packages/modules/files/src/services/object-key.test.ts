import { describe, expect, it } from "vitest";

import { CATALOG_RENDITIONS } from "../wire.contract.js";
import {
  catalogObjectKey,
  catalogRenditionObjectKey,
  documentObjectKey,
  signingObjectKey,
  stagingObjectKey,
} from "./object-key.js";

const companyId = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";

describe("catalogObjectKey", () => {
  it("is {companyId}/catalog/{fileId} and is not client-supplied", () => {
    expect(catalogObjectKey(companyId, fileId)).toBe(
      `${companyId}/catalog/${fileId}`,
    );
    expect(catalogObjectKey(companyId, fileId)).not.toContain("documents");
    expect(catalogObjectKey(companyId, fileId)).not.toContain("http");
  });
});

describe("documentObjectKey", () => {
  it("is {companyId}/documents/{fileId} and is not client-supplied", () => {
    expect(documentObjectKey(companyId, fileId)).toBe(
      `${companyId}/documents/${fileId}`,
    );
    expect(documentObjectKey(companyId, fileId)).not.toContain("/catalog/");
    expect(documentObjectKey(companyId, fileId)).not.toContain("/uploads/");
    expect(documentObjectKey(companyId, fileId)).not.toContain("http");
    expect(documentObjectKey(companyId, fileId)).not.toBe(
      catalogObjectKey(companyId, fileId),
    );
  });
});

describe("signingObjectKey", () => {
  it("is {companyId}/signing/{fileId} and is not client-supplied", () => {
    expect(signingObjectKey(companyId, fileId)).toBe(
      `${companyId}/signing/${fileId}`,
    );
    expect(signingObjectKey(companyId, fileId)).not.toContain("/catalog/");
    expect(signingObjectKey(companyId, fileId)).not.toContain("/documents/");
    expect(signingObjectKey(companyId, fileId)).not.toContain("/uploads/");
    expect(signingObjectKey(companyId, fileId)).not.toContain("http");
    expect(signingObjectKey(companyId, fileId)).not.toBe(
      catalogObjectKey(companyId, fileId),
    );
    expect(signingObjectKey(companyId, fileId)).not.toBe(
      documentObjectKey(companyId, fileId),
    );
  });
});

describe("catalogRenditionObjectKey", () => {
  it("is {companyId}/catalog/{fileId}/{rendition} and is not the original key", () => {
    for (const rendition of CATALOG_RENDITIONS) {
      expect(catalogRenditionObjectKey(companyId, fileId, rendition)).toBe(
        `${companyId}/catalog/${fileId}/${rendition}`,
      );
      expect(catalogRenditionObjectKey(companyId, fileId, rendition)).not.toBe(
        catalogObjectKey(companyId, fileId),
      );
      expect(
        catalogRenditionObjectKey(companyId, fileId, rendition),
      ).not.toContain("/uploads/");
      expect(
        catalogRenditionObjectKey(companyId, fileId, rendition),
      ).not.toContain("http");
    }
    expect(catalogRenditionObjectKey(companyId, fileId, "full")).not.toBe(
      catalogObjectKey(companyId, fileId),
    );
  });
});

describe("stagingObjectKey", () => {
  it("is {companyId}/uploads/{fileId} and is distinct from the durable key", () => {
    expect(stagingObjectKey(companyId, fileId)).toBe(
      `${companyId}/uploads/${fileId}`,
    );
    expect(stagingObjectKey(companyId, fileId)).not.toBe(
      catalogObjectKey(companyId, fileId),
    );
    expect(stagingObjectKey(companyId, fileId)).not.toContain("/catalog/");
    expect(stagingObjectKey(companyId, fileId)).not.toContain("http");
  });
});
