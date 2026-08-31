import { ValidationError } from "@showzy/core/errors";
import type { z } from "zod";

export function requireOrValidationError<S extends z.ZodType>(
  schema: S,
  value: unknown,
  clientMessage: string,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues, clientMessage);
  }
  return parsed.data;
}
