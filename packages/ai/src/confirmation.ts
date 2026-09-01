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

export const STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT =
  "Confirmation required.";
