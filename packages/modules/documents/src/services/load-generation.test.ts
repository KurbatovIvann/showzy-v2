import { describe, expect, it } from "vitest";

import { NotFoundError } from "@showzy/core/errors";

import {
  loadGenerationArtifact,
  readyArtifactFileId,
} from "./load-generation.js";

describe("loadGenerationArtifact", () => {
  it("maps missing jobs to a pending chip and returns ready artifacts", async () => {
    const pending = await loadGenerationArtifact({
      documentId: "11111111-1111-4111-8111-111111111111",
      getArtifact: () => Promise.reject(new NotFoundError()),
    });
    expect(pending).toEqual({ status: "pending", fileId: null });

    const fileId = "22222222-2222-4222-8222-222222222222";
    const ready = await loadGenerationArtifact({
      documentId: "11111111-1111-4111-8111-111111111111",
      getArtifact: () => Promise.resolve({ status: "ready", fileId }),
    });
    expect(ready).toEqual({ status: "ready", fileId });
    expect(readyArtifactFileId(ready)).toBe(fileId);
    expect(readyArtifactFileId(pending)).toBeNull();
  });
});
