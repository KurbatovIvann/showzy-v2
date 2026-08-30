import { describe, expect, it } from "vitest";

import {
  issueSigningDownloadUrlContract,
  issueSigningDownloadUrlInputSchema,
  issueSigningDownloadUrlOutputSchema,
} from "./issue-signing-download-url.contract.js";

describe("files.issueSigningDownloadUrl contract", () => {
  it("is a staff internal read with documents:view, not files:view", () => {
    expect(issueSigningDownloadUrlContract.name).toBe(
      "files.issueSigningDownloadUrl",
    );
    expect(issueSigningDownloadUrlContract.principal).toBe("staff");
    expect(issueSigningDownloadUrlContract.transport).toBe("internal");
    expect(issueSigningDownloadUrlContract.risk).toBe("read");
    expect(issueSigningDownloadUrlContract.permissions).toEqual([
      "documents:view",
    ]);
    expect(issueSigningDownloadUrlContract.permissions).not.toContain(
      "files:view",
    );
    expect(issueSigningDownloadUrlContract.aiExposure).toBe("internal");
    expect(issueSigningDownloadUrlContract.audit).toBe(false);
    expect(issueSigningDownloadUrlContract.idempotent).toBe(false);
    expect(issueSigningDownloadUrlContract.emits).toEqual([]);
    expect(issueSigningDownloadUrlContract.timeout).toBe(5_000);
    expect(issueSigningDownloadUrlContract.description).toContain("attachment");
    expect(issueSigningDownloadUrlContract.description).toContain(
      "application/vnd.etsi.asic-e+zip",
    );
    expect(issueSigningDownloadUrlContract.description).toContain(
      "document.asice",
    );
  });

  it("accepts only fileId — never a company id, object key, or URL", () => {
    expect(
      Object.keys(issueSigningDownloadUrlInputSchema.shape).toSorted(),
    ).toEqual(["fileId"]);
    expect(
      Object.keys(issueSigningDownloadUrlOutputSchema.shape).toSorted(),
    ).toEqual(["downloadUrl", "expiresAt", "fileId"]);
  });
});
