import { describe, expect, it } from "vitest";

import {
  issueDocumentDownloadUrlContract,
  issueDocumentDownloadUrlInputSchema,
  issueDocumentDownloadUrlOutputSchema,
} from "./issue-document-download-url.contract.js";

describe("files.issueDocumentDownloadUrl contract", () => {
  it("is a staff internal read with documents:view, not files:view", () => {
    expect(issueDocumentDownloadUrlContract.name).toBe(
      "files.issueDocumentDownloadUrl",
    );
    expect(issueDocumentDownloadUrlContract.principal).toBe("staff");
    expect(issueDocumentDownloadUrlContract.transport).toBe("internal");
    expect(issueDocumentDownloadUrlContract.risk).toBe("read");
    expect(issueDocumentDownloadUrlContract.permissions).toEqual([
      "documents:view",
    ]);
    expect(issueDocumentDownloadUrlContract.permissions).not.toContain(
      "files:view",
    );
    expect(issueDocumentDownloadUrlContract.aiExposure).toBe("internal");
    expect(issueDocumentDownloadUrlContract.audit).toBe(false);
    expect(issueDocumentDownloadUrlContract.idempotent).toBe(false);
    expect(issueDocumentDownloadUrlContract.emits).toEqual([]);
    expect(issueDocumentDownloadUrlContract.timeout).toBe(5_000);
    expect(issueDocumentDownloadUrlContract.description).toContain("inline");
    expect(issueDocumentDownloadUrlContract.description).toContain(
      "application/pdf",
    );
    expect(issueDocumentDownloadUrlContract.description).toContain(
      "document.pdf",
    );
  });

  it("accepts only fileId — never a company id, object key, or URL", () => {
    expect(
      Object.keys(issueDocumentDownloadUrlInputSchema.shape).toSorted(),
    ).toEqual(["fileId"]);
    expect(
      Object.keys(issueDocumentDownloadUrlOutputSchema.shape).toSorted(),
    ).toEqual(["checksumSha256", "downloadUrl", "expiresAt", "fileId"]);
  });
});
