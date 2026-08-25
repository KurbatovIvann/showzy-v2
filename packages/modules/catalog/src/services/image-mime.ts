import { ValidationError } from "@showzy/core/errors";
import { z } from "zod";

const factsImageGate = z.object({
  fileIds: z.array(
    z.object({
      fileId: z.uuid(),
      mimeType: z.string().startsWith("image/", {
        message: "Product images must use an image MIME type.",
      }),
    }),
  ),
});

/**
 * Defense in depth after `files.getAttachmentFacts`: facts currently only
 * returns JPEG/PNG/WebP, but catalog still rejects any non-image MIME the
 * facts action might later admit.
 */
export function rejectNonImageAttachments(
  files: readonly { readonly fileId: string; readonly mimeType: string }[],
): void {
  const parsed = factsImageGate.safeParse({
    fileIds: files.map((file) => ({
      fileId: file.fileId,
      mimeType: file.mimeType,
    })),
  });
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues,
      "Product images must use an image MIME type.",
    );
  }
}
