import type {
  AssistantChatMessage,
  PendingConfirmation,
} from "./confirmation-presenter";

export type AssistantChatRow = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly confirmation: PendingConfirmation | null;
};

function textFromParts(message: AssistantChatMessage): string {
  const chunks: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text" && typeof part.text === "string") {
      chunks.push(part.text);
    }
  }
  return chunks.join("");
}

export function assistantChatRows(
  messages: readonly AssistantChatMessage[],
  pending: PendingConfirmation | null,
): readonly AssistantChatRow[] {
  const rows: AssistantChatRow[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }
    const text = textFromParts(message);
    const confirmation =
      pending !== null && pending.messageId === message.id ? pending : null;
    if (text.length === 0 && confirmation === null) {
      continue;
    }
    rows.push({
      id: message.id,
      role: message.role,
      text,
      confirmation,
    });
  }
  return rows;
}
