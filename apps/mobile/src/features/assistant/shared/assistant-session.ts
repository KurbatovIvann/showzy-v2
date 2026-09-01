/**
 * Tenant chat session helpers for the staff assistant. Company id is a
 * selector, never action input. Switching companies must not reuse the
 * previous conversation id or messages.
 */

export type AssistantCompanyEpochRef = { current: number };
export type AssistantConversationIdRef = { current: string | null };

function isCurrentAssistantEpoch(
  companyEpochRef: AssistantCompanyEpochRef,
  epoch: number,
): boolean {
  return companyEpochRef.current === epoch;
}

export async function ensureAssistantConversation(args: {
  readonly conversationIdRef: AssistantConversationIdRef;
  readonly companyEpochRef: AssistantCompanyEpochRef;
  readonly epoch: number;
  readonly create: () => Promise<{ readonly id: string }>;
}): Promise<string | null> {
  const existing = args.conversationIdRef.current;
  if (existing !== null) {
    return isCurrentAssistantEpoch(args.companyEpochRef, args.epoch)
      ? existing
      : null;
  }
  const created = await args.create();
  if (!isCurrentAssistantEpoch(args.companyEpochRef, args.epoch)) {
    return null;
  }
  args.conversationIdRef.current = created.id;
  return created.id;
}

export async function sendEnsuredAssistantMessage(args: {
  readonly conversationIdRef: AssistantConversationIdRef;
  readonly companyEpochRef: AssistantCompanyEpochRef;
  readonly create: () => Promise<{ readonly id: string }>;
  readonly sendMessage: (payload: { readonly text: string }) => Promise<void>;
  readonly text: string;
}): Promise<"sent" | "dropped"> {
  const epoch = args.companyEpochRef.current;
  const conversationId = await ensureAssistantConversation({
    conversationIdRef: args.conversationIdRef,
    companyEpochRef: args.companyEpochRef,
    epoch,
    create: args.create,
  });
  if (
    conversationId === null ||
    !isCurrentAssistantEpoch(args.companyEpochRef, epoch)
  ) {
    return "dropped";
  }
  await args.sendMessage({ text: args.text });
  return "sent";
}

export function resetAssistantTenantSession(args: {
  readonly conversationIdRef: AssistantConversationIdRef;
  readonly setMessages: (messages: []) => void;
  readonly resetConfirmation: () => void;
}): void {
  args.conversationIdRef.current = null;
  args.setMessages([]);
  args.resetConfirmation();
}
