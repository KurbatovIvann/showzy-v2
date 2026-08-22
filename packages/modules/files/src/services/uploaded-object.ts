import { CoreInvariantError, ValidationError } from "@showzy/core/errors";
import { z } from "zod";

const uploadedObjectFailed = z.object({
  valid: z.literal(true, {
    error: "The uploaded object failed validation.",
  }),
});

/** Same-tenant object that failed size, magic, MIME, checksum, or prefix. */
export function uploadedObjectInvalid(): ValidationError {
  const parsed = uploadedObjectFailed.safeParse({ valid: false });
  if (parsed.success) {
    throw new CoreInvariantError(
      "uploaded-object validation fixture produced success",
    );
  }
  return new ValidationError(
    parsed.error.issues,
    "The uploaded object failed validation.",
  );
}
