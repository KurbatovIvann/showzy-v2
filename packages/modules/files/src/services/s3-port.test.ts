import { describe, expect, it } from "vitest";

import { copySourceHeader } from "./s3-port.js";

describe("copySourceHeader", () => {
  it("is bucket/key without a leading slash (S3/R2 CopySource form)", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const fileId = "22222222-2222-4222-8222-222222222222";
    expect(copySourceHeader("showzy", `${companyId}/uploads/${fileId}`)).toBe(
      `showzy/${companyId}/uploads/${fileId}`,
    );
    expect(
      copySourceHeader("showzy", `${companyId}/uploads/${fileId}`).startsWith(
        "/",
      ),
    ).toBe(false);
  });
});
