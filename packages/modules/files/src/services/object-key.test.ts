import { describe, expect, it } from "vitest";

import { catalogObjectKey } from "./object-key.js";

describe("catalogObjectKey", () => {
  it("is {companyId}/catalog/{fileId} and is not client-supplied", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const fileId = "22222222-2222-4222-8222-222222222222";
    expect(catalogObjectKey(companyId, fileId)).toBe(
      `${companyId}/catalog/${fileId}`,
    );
    expect(catalogObjectKey(companyId, fileId)).not.toContain("documents");
    expect(catalogObjectKey(companyId, fileId)).not.toContain("http");
  });
});
