import { ValidationError } from "@showzy/core/errors";
import { z } from "zod";

const imageMimeSchema = z.string().startsWith("image/", {
  message: "Product images must use an image MIME type.",
});

/**
 * Defense in depth after `files.getAttachmentFacts`: facts currently only
 * returns JPEG/PNG/WebP, but catalog still rejects any non-image MIME the
 * facts action might later admit (ticket: whole-batch validation failure).
 */
export function rejectNonImageAttachments(
  files: readonly { readonly mimeType: string }[],
): void {
  for (const file of files) {
    const parsed = imageMimeSchema.safeParse(file.mimeType);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues,
        "Product images must use an image MIME type.",
      );
    }
  }
}
