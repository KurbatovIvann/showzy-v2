import { describe, expect, it } from "vitest";

import { artifactFileId } from "./artifact-file-id.js";

const documentA = "11111111-1111-4111-8111-111111111111";
const documentB = "22222222-2222-4222-8222-222222222222";

describe("artifactFileId", () => {
  it("is a stable UUID v5 for the same document and differs across documents", () => {
    const first = artifactFileId(documentA);
    const second = artifactFileId(documentA);
    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(artifactFileId(documentB)).not.toBe(first);
  });
});
