import { describe, expect, it } from "vitest";

import {
  issueShareSigningDownloadUrlContract,
  issueShareSigningDownloadUrlInputSchema,
  issueShareSigningDownloadUrlOutputSchema,
} from "./issue-share-signing-download-url.contract.js";

describe("files.issueShareSigningDownloadUrl contract", () => {
  it("is a staff internal read with files:view, nested from documents.share", () => {
    expect(issueShareSigningDownloadUrlContract.name).toBe(
      "files.issueShareSigningDownloadUrl",
    );
    expect(issueShareSigningDownloadUrlContract.principal).toBe("staff");
    expect(issueShareSigningDownloadUrlContract.transport).toBe("internal");
    expect(issueShareSigningDownloadUrlContract.transport).not.toBe("public");
    expect(issueShareSigningDownloadUrlContract.risk).toBe("read");
    expect(issueShareSigningDownloadUrlContract.permissions).toEqual([
      "files:view",
    ]);
    expect(issueShareSigningDownloadUrlContract.aiExposure).toBe("internal");
    expect(issueShareSigningDownloadUrlContract.audit).toBe(false);
    expect(issueShareSigningDownloadUrlContract.idempotent).toBe(false);
    expect(issueShareSigningDownloadUrlContract.emits).toEqual([]);
    expect(issueShareSigningDownloadUrlContract.atomicCallers).toEqual([]);
    expect(issueShareSigningDownloadUrlContract.timeout).toBe(5_000);
    expect(issueShareSigningDownloadUrlContract.description).toContain(
      "documents.share",
    );
    expect(issueShareSigningDownloadUrlContract.description).toContain(
      "attachment",
    );
    expect(issueShareSigningDownloadUrlContract.description).toContain(
      "document.asice",
    );
  });

  it("accepts only fileId — never a company id, object key, or URL", () => {
    expect(
      Object.keys(issueShareSigningDownloadUrlInputSchema.shape).toSorted(),
    ).toEqual(["fileId"]);
    expect(
      Object.keys(issueShareSigningDownloadUrlOutputSchema.shape).toSorted(),
    ).toEqual(["downloadUrl", "expiresAt", "fileId"]);
  });
});
