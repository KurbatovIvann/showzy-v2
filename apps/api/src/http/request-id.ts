import { randomUUID } from "node:crypto";

import { z } from "zod";

/** Correlation header echoed on every response (security-operations §6). */
export const REQUEST_ID_HEADER = "x-request-id";

const uuidSchema = z.uuid();

/**
 * Accept a caller-supplied request id only when it is a UUID; otherwise mint
 * one. Arbitrary strings are not correlation ids — they would leak into
 * logs and spans.
 */
export function resolveRequestId(incoming: string | undefined): string {
  if (incoming === undefined || incoming.trim() === "") {
    return randomUUID();
  }
  const parsed = uuidSchema.safeParse(incoming.trim());
  return parsed.success ? parsed.data : randomUUID();
}
