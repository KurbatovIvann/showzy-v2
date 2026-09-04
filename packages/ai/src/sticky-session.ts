/**
 * Intent-routing skip for HITL resumes only (SHO-404). Confirmation and
 * choice resumes do not run the classifier. A later user turn after tool
 * runs still routes — `sticky_session` must not bypass intent.
 */
export type StaffAssistantGateSkipReason =
  "confirmation_resume" | "choice_resume";

export function staffAssistantShouldSkipIntentGate(options: {
  readonly confirmationResume?: boolean;
  readonly choiceResume?: boolean;
}): boolean {
  return options.confirmationResume === true || options.choiceResume === true;
}
