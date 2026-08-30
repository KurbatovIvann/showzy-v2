import { describe, expect, it } from "vitest";

import {
  issueSystemSigningDownloadUrlContract,
  issueSystemSigningDownloadUrlInputSchema,
  issueSystemSigningDownloadUrlOutputSchema,
} from "./issue-system-signing-download-url.contract.js";

describe("files.issueSystemSigningDownloadUrl contract", () => {
  it("is a tenant system internal read with empty permissions", () => {
    expect(issueSystemSigningDownloadUrlContract.name).toBe(
      "files.issueSystemSigningDownloadUrl",
    );
    expect(issueSystemSigningDownloadUrlContract.principal).toBe("system");
    expect(issueSystemSigningDownloadUrlContract.systemScope).toBe("tenant");
    expect(issueSystemSigningDownloadUrlContract.transport).toBe("internal");
    expect(issueSystemSigningDownloadUrlContract.risk).toBe("read");
    expect(issueSystemSigningDownloadUrlContract.permissions).toEqual([]);
    expect(issueSystemSigningDownloadUrlContract.aiExposure).toBe("internal");
    expect(issueSystemSigningDownloadUrlContract.audit).toBe(false);
    expect(issueSystemSigningDownloadUrlContract.idempotent).toBe(false);
    expect(issueSystemSigningDownloadUrlContract.emits).toEqual([]);
    expect(issueSystemSigningDownloadUrlContract.atomicCallers).toEqual([]);
    expect(issueSystemSigningDownloadUrlContract.timeout).toBe(5_000);
    expect(issueSystemSigningDownloadUrlContract.description).toContain(
      "documents.attachSignedShare",
    );
    expect(issueSystemSigningDownloadUrlContract.description).toContain(
      "attachment",
    );
    expect(issueSystemSigningDownloadUrlContract.description).toContain(
      "document.asice",
    );
  });

  it("accepts only fileId — never a company id, object key, or URL", () => {
    expect(
      Object.keys(issueSystemSigningDownloadUrlInputSchema.shape).toSorted(),
    ).toEqual(["fileId"]);
    expect(
      Object.keys(issueSystemSigningDownloadUrlOutputSchema.shape).toSorted(),
    ).toEqual(["downloadUrl", "expiresAt", "fileId"]);
  });
});
