/**
 * Deterministic continuation for the staff operational gate.
 * Short acks after a tool-using turn stay on Sonnet+tools; they are not
 * a new Haiku classify. The classifier still runs for weather and for
 * acks on empty conversations.
 */
const ACK_PHRASES = new Set([
  "так",
  "так зроби",
  "так будь ласка",
  "ок",
  "окей",
  "оке",
  "добре",
  "добре зроби",
  "все вірно",
  "все правильно",
  "вірно",
  "зроби",
  "давай",
  "давай зроби",
  "підтверджую",
  "згоден",
  "згодна",
  "угу",
  "ага",
  "yes",
  "yep",
  "yeah",
  "ok",
  "okay",
  "sure",
  "do it",
  "go ahead",
  "proceed",
  "confirm",
  "correct",
  "right",
]);

export function normalizeStaffAssistantAck(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("uk")
    .replaceAll(/[\s\u00a0]+/g, " ")
    .replaceAll(/^[«»"'“”]+|[«»"'“”]+$/g, "")
    .replaceAll(/[.!?…,;:]+$/g, "")
    .trim();
}

export function isStaffAssistantContinuationAck(text: string): boolean {
  const normalized = normalizeStaffAssistantAck(text);
  return ACK_PHRASES.has(normalized);
}

export function staffAssistantShouldSkipOperationalGate(options: {
  readonly lastUserText: string;
  readonly toolRunCount: number;
}): boolean {
  return (
    options.toolRunCount > 0 &&
    isStaffAssistantContinuationAck(options.lastUserText)
  );
}

export type StaffAssistantGateSkipReason = "continuation_ack";
