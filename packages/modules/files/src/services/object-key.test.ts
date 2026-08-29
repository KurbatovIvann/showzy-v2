import { describe, expect, it } from "vitest";

import {
  catalogObjectKey,
  documentObjectKey,
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
