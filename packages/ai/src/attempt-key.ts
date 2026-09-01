/**
 * Logical-attempt idempotency keys for the staff AI mount (SHO-322).
 *
 * `idempotencyKey` identifies an attempt, not content. Core still hashes
 * validated input separately (same key + same input → replay; same key +
 * different input → conflict). `conversationId` is a namespace so IDs
 * cannot collide across conversations — it is not an access grant.
 */
export type StaffAssistantAttemptKind = "message" | "tool" | "turn";

export function attemptKey(
  kind: StaffAssistantAttemptKind,
  conversationId: string,
  id: string,
): string {
  return `${kind}:${conversationId}:${id}`;
}
