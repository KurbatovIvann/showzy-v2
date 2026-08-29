import { describe, expect, it } from "vitest";

import { getDownloadUrlContract } from "./get-download-url.contract.js";

describe("files.getDownloadUrl contract", () => {
  it("is a staff client read with files:view, unaudited, and not an idempotent write", () => {
    expect(getDownloadUrlContract.name).toBe("files.getDownloadUrl");
    expect(getDownloadUrlContract.principal).toBe("staff");
    expect(getDownloadUrlContract.transport).toBe("client");
    expect(getDownloadUrlContract.risk).toBe("read");
    expect(getDownloadUrlContract.permissions).toEqual(["files:view"]);
    expect(getDownloadUrlContract.aiExposure).toBe("exposed");
    expect(getDownloadUrlContract.audit).toBe(false);
    expect(getDownloadUrlContract.idempotent).toBe(false);
    expect(getDownloadUrlContract.emits).toEqual([]);
    expect(getDownloadUrlContract.timeout).toBe(5_000);
    expect(getDownloadUrlContract.description).toContain("inline");
    expect(getDownloadUrlContract.description).toContain("image/jpeg");
  });
});
