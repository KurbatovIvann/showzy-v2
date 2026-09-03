/**
 * Live-turn tool timeline from current `UIMessage` parts (SHO-368).
 * Parse part names only — no list/aggregate cards, no persistence.
 */
import type { AssistantChatPart } from "./confirmation-presenter";

export type AssistantTimelineStatus = "queued" | "running" | "done" | "error";

export type AssistantToolStep = {
  readonly id: string;
  readonly toolName: string;
  readonly status: AssistantTimelineStatus;
};

const TOOL_TYPE_PREFIX = "tool-";
const DYNAMIC_TOOL_TYPE = "dynamic-tool";

export function toolNameFromPart(part: AssistantChatPart): string | null {
  if (part.type === DYNAMIC_TOOL_TYPE) {
    return typeof part.toolName === "string" && part.toolName.length > 0
      ? part.toolName
      : null;
  }
  if (
    part.type.startsWith(TOOL_TYPE_PREFIX) &&
    part.type.length > TOOL_TYPE_PREFIX.length
  ) {
    return part.type.slice(TOOL_TYPE_PREFIX.length);
  }
  return null;
}

export function timelineStatusFromPartState(
  state: string | undefined,
): AssistantTimelineStatus {
  switch (state) {
    case "output-available":
      return "done";
    case "output-error":
    case "output-denied":
      return "error";
    case "input-streaming":
      return "queued";
    default:
      return "running";
  }
}

/**
 * Ordered live-turn tool steps. Skips text and `data-confirmation`.
 * Does not stringify `output`.
 */
export function toolStepsFromParts(
  parts: readonly AssistantChatPart[],
  messageId: string,
): readonly AssistantToolStep[] {
  const steps: AssistantToolStep[] = [];
  for (const [index, part] of parts.entries()) {
    const toolName = toolNameFromPart(part);
    if (toolName === null) {
      continue;
    }
    const callId = part.toolCallId;
    steps.push({
      id:
        typeof callId === "string" && callId.length > 0
          ? callId
          : `${messageId}:${String(index)}`,
      toolName,
      status: timelineStatusFromPartState(part.state),
    });
  }
  return steps;
}
