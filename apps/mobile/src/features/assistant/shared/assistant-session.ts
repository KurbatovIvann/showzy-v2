/**
 * Tenant chat session helpers for the staff assistant. Company id is a
 * selector, never action input. Switching companies must not reuse the
 * previous conversation id or messages.
 */

export async function ensureAssistantConversation(args: {
  readonly conversationIdRef: { current: string | null };
  readonly create: () => Promise<{ readonly id: string }>;
}): Promise<string> {
  const existing = args.conversationIdRef.current;
  if (existing !== null) {
    return existing;
  }
  const created = await args.create();
  args.conversationIdRef.current = created.id;
  return created.id;
}

export function resetAssistantTenantSession(args: {
  readonly conversationIdRef: { current: string | null };
  readonly setMessages: (messages: []) => void;
  readonly resetConfirmation: () => void;
}): void {
  args.conversationIdRef.current = null;
  args.setMessages([]);
  args.resetConfirmation();
}
