import { ValidationError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { rejectNonImageAttachments } from "./image-mime.js";

const jpegId = "11111111-1111-4111-8111-111111111111";
const pdfId = "22222222-2222-4222-8222-222222222222";
const textId = "33333333-3333-4333-8333-333333333333";

describe("rejectNonImageAttachments", () => {
  it("accepts image MIME types returned by files facts today", () => {
    expect(() => {
      rejectNonImageAttachments([
        { fileId: jpegId, mimeType: "image/jpeg" },
        {
          fileId: "44444444-4444-4444-8444-444444444444",
          mimeType: "image/png",
        },
        {
          fileId: "55555555-5555-4555-8555-555555555555",
          mimeType: "image/webp",
        },
      ]);
    }).not.toThrow();
  });

  it("fails the whole batch for a non-image MIME with ValidationError on fileIds", () => {
    expect(() => {
      rejectNonImageAttachments([
        { fileId: jpegId, mimeType: "image/jpeg" },
        { fileId: pdfId, mimeType: "application/pdf" },
      ]);
    }).toThrow(ValidationError);

    try {
      rejectNonImageAttachments([{ fileId: textId, mimeType: "text/plain" }]);
      throw new Error("expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.clientMessage).toBe(
          "Product images must use an image MIME type.",
        );
        expect(error.issues[0]?.path).toEqual(["fileIds", 0, "mimeType"]);
      }
    }
  });
});
