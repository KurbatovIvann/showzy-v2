import { ValidationError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { rejectNonImageAttachments } from "./image-mime.js";

describe("rejectNonImageAttachments", () => {
  it("accepts image MIME types returned by files facts today", () => {
    expect(() => {
      rejectNonImageAttachments([
        { mimeType: "image/jpeg" },
        { mimeType: "image/png" },
        { mimeType: "image/webp" },
      ]);
    }).not.toThrow();
  });

  it("fails the whole batch for a non-image MIME with ValidationError", () => {
    expect(() => {
      rejectNonImageAttachments([
        { mimeType: "image/jpeg" },
        { mimeType: "application/pdf" },
      ]);
    }).toThrow(ValidationError);

    try {
      rejectNonImageAttachments([{ mimeType: "text/plain" }]);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.clientMessage).toBe(
          "Product images must use an image MIME type.",
        );
      }
    }
  });
});
