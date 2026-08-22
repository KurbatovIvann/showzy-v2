import { describe, expect, it } from "vitest";

import { getUploadUrlContract } from "./get-upload-url.contract.js";

describe("files.getUploadUrl contract", () => {
  it("is a staff client read with files:upload, unaudited, and not an idempotent write", () => {
    expect(getUploadUrlContract.name).toBe("files.getUploadUrl");
    expect(getUploadUrlContract.principal).toBe("staff");
    expect(getUploadUrlContract.transport).toBe("client");
    expect(getUploadUrlContract.risk).toBe("read");
    expect(getUploadUrlContract.permissions).toEqual(["files:upload"]);
    expect(getUploadUrlContract.aiExposure).toBe("exposed");
    expect(getUploadUrlContract.audit).toBe(false);
    expect(getUploadUrlContract.idempotent).toBe(false);
    expect(getUploadUrlContract.emits).toEqual([]);
    expect(getUploadUrlContract.timeout).toBe(5_000);
  });
});
