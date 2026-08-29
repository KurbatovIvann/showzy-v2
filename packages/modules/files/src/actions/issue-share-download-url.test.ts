import { describe, expect, it } from "vitest";

import {
  issueShareDownloadUrlContract,
  issueShareDownloadUrlInputSchema,
  issueShareDownloadUrlOutputSchema,
} from "./issue-share-download-url.contract.js";

describe("files.issueShareDownloadUrl contract", () => {
  it("is a staff internal read with files:view, nested from documents.share", () => {
    expect(issueShareDownloadUrlContract.name).toBe(
      "files.issueShareDownloadUrl",
    );
    expect(issueShareDownloadUrlContract.principal).toBe("staff");
    expect(issueShareDownloadUrlContract.transport).toBe("internal");
    expect(issueShareDownloadUrlContract.transport).not.toBe("public");
    expect(issueShareDownloadUrlContract.risk).toBe("read");
    expect(issueShareDownloadUrlContract.permissions).toEqual(["files:view"]);
    expect(issueShareDownloadUrlContract.aiExposure).toBe("internal");
    expect(issueShareDownloadUrlContract.audit).toBe(false);
    expect(issueShareDownloadUrlContract.idempotent).toBe(false);
    expect(issueShareDownloadUrlContract.emits).toEqual([]);
    expect(issueShareDownloadUrlContract.timeout).toBe(5_000);
    expect(issueShareDownloadUrlContract.description).toContain(
      "documents.share",
    );
    expect(issueShareDownloadUrlContract.description).toContain("inline");
  });

  it("accepts only fileId — never a company id, object key, or URL", () => {
    expect(
      Object.keys(issueShareDownloadUrlInputSchema.shape).toSorted(),
    ).toEqual(["fileId"]);
    expect(
      Object.keys(issueShareDownloadUrlOutputSchema.shape).toSorted(),
    ).toEqual(["downloadUrl", "expiresAt", "fileId"]);
  });
});
