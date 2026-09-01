/**
 * Client-side `data-confirmation` envelope (SHO-323). Duplicates the
 * `@showzy/ai` parser — mobile must not import that package.
 */
import { z } from "zod";

export const STAFF_ASSISTANT_CONFIRMATION_STATUS =
  "confirmation_required" as const;

export const staffAssistantConfirmationSchema = z.object({
  status: z.literal(STAFF_ASSISTANT_CONFIRMATION_STATUS),
  challengeId: z.uuid(),
  summary: z.string().min(1),
  expiresAt: z.string().min(1),
  actionName: z.string().min(1),
  toolCallId: z.string().min(1),
});

export type StaffAssistantConfirmation = z.infer<
  typeof staffAssistantConfirmationSchema
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Accept the streamed `data-confirmation` envelope or a flattened
 * confirmation object the client echoes in `messages[].parts`.
 */
export function confirmationFromChatPart(
  part: unknown,
): StaffAssistantConfirmation | undefined {
  const parsed = staffAssistantConfirmationSchema.safeParse(part);
  if (parsed.success) {
    return parsed.data;
  }
  if (!isRecord(part)) {
    return undefined;
  }
  const nested = staffAssistantConfirmationSchema.safeParse(part.data);
  return nested.success ? nested.data : undefined;
}
