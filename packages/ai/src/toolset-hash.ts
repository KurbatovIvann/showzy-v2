import { createHash } from "node:crypto";

/** Empty attached catalog — not a SHA-256 of the empty string. */
export const STAFF_ASSISTANT_EMPTY_TOOLSET_HASH = "empty";

/**
 * Stable short hash of sorted provider tool names. Logs only — never
 * includes schemas or payloads.
 */
export function staffAssistantToolsetHash(
  providerNames: readonly string[],
): string {
  if (providerNames.length === 0) {
    return STAFF_ASSISTANT_EMPTY_TOOLSET_HASH;
  }
  const canonical = [...providerNames].sort().join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
