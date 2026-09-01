import { z } from "zod";

export const STAFF_ASSISTANT_CONFIRMATION_STATUS =
  "confirmation_required" as const;

export const staffAssistantConfirmationOutputSchema = z.object({
  status: z.literal(STAFF_ASSISTANT_CONFIRMATION_STATUS),
  challengeId: z.uuid(),
  summary: z.string().min(1),
  expiresAt: z.string().min(1),
  actionName: z.string().min(1),
  toolCallId: z.string().min(1),
});

export type StaffAssistantConfirmationOutput = z.infer<
  typeof staffAssistantConfirmationOutputSchema
>;

export function isStaffAssistantConfirmationOutput(
  value: unknown,
): value is StaffAssistantConfirmationOutput {
  return staffAssistantConfirmationOutputSchema.safeParse(value).success;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Accept the streamed `data-confirmation` envelope or a flattened
 * confirmation object that a client echoes back in `messages[].parts`.
 */
export function confirmationFromChatPart(
  part: unknown,
): StaffAssistantConfirmationOutput | undefined {
  if (isStaffAssistantConfirmationOutput(part)) {
    return part;
  }
  if (!isRecord(part)) {
    return undefined;
  }
  return isStaffAssistantConfirmationOutput(part.data) ? part.data : undefined;
}

export const STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT =
  "Confirmation required.";
