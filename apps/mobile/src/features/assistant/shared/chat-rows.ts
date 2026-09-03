import type { AssistantCopy } from "../../../i18n/assistant";
import type {
  AssistantChatMessage,
  PendingConfirmation,
} from "./confirmation-presenter";
import { assistantJobLabel } from "./job-labels";
import {
  toolStepsFromParts,
  type AssistantTimelineStatus,
} from "./turn-timeline";

export type AssistantTimelineStep = {
  readonly id: string;
  readonly label: string;
  readonly status: AssistantTimelineStatus;
};

export type AssistantChatRow = {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly confirmation: PendingConfirmation | null;
  readonly timeline: readonly AssistantTimelineStep[];
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

function labeledTimeline(
  message: AssistantChatMessage,
  copy: AssistantCopy,
): readonly AssistantTimelineStep[] {
  return toolStepsFromParts(message.parts, message.id).map((step) => ({
    id: step.id,
    label: assistantJobLabel(step.toolName, copy),
    status: step.status,
  }));
}

export function assistantChatRows(
  messages: readonly AssistantChatMessage[],
  pending: PendingConfirmation | null,
  copy: AssistantCopy,
): readonly AssistantChatRow[] {
  const rows: AssistantChatRow[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }
    const text = textFromParts(message);
    const confirmation =
      pending !== null && pending.messageId === message.id ? pending : null;
    const timeline =
      message.role === "assistant" ? labeledTimeline(message, copy) : [];
    if (text.length === 0 && confirmation === null && timeline.length === 0) {
      continue;
    }
    rows.push({
      id: message.id,
      role: message.role,
      text,
      confirmation,
      timeline,
    });
  }
  return rows;
}

export function assistantRowHasInFlightTools(row: AssistantChatRow): boolean {
  return row.timeline.some(
    (step) => step.status === "queued" || step.status === "running",
  );
}
