import { CoreInvariantError } from "@showzy/core/errors";
import type { z } from "zod";

export function parseDbEnum<S extends z.ZodType>(
  schema: S,
  value: unknown,
  message: string,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new CoreInvariantError(message);
  }
  return parsed.data;
}
