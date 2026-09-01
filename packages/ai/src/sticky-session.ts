/**
 * Sticky operational session for the staff gate. After any tool run in
 * the conversation, later turns stay on Sonnet+tools. The classifier
 * runs only on conversations that have not used tools yet (first turn,
 * or chitchat that never executed an action). Phrase allowlists are not
 * part of this decision.
 */
export type StaffAssistantGateSkipReason = "sticky_session";

export function staffAssistantShouldSkipOperationalGate(options: {
  readonly toolRunCount: number;
}): boolean {
  return options.toolRunCount > 0;
}
