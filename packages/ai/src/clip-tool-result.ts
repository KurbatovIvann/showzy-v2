/**
 * Clip large tool results before they are fed back into the model within
 * a turn (SHO-341). Persistence still uses the unclipped execute output.
 */
import { isStaffAssistantConfirmationOutput } from "./confirmation.js";

export const STAFF_ASSISTANT_CLIP_ARRAY_MAX = 20;
export const STAFF_ASSISTANT_CLIP_JSON_MAX = 4_000;
export const STAFF_ASSISTANT_CLIPPED_STATUS = "clipped" as const;

export interface StaffAssistantClippedResult {
  readonly status: typeof STAFF_ASSISTANT_CLIPPED_STATUS;
  readonly preview: unknown;
  readonly omitted: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTypedToolError(value: unknown): boolean {
  return (
    isRecord(value) &&
    value["status"] === "error" &&
    typeof value["code"] === "string" &&
    typeof value["message"] === "string"
  );
}

function jsonLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return STAFF_ASSISTANT_CLIP_JSON_MAX + 1;
  }
}

function clipUnknown(value: unknown): { preview: unknown; omitted: number } {
  if (Array.isArray(value)) {
    const extra = Math.max(0, value.length - STAFF_ASSISTANT_CLIP_ARRAY_MAX);
    const kept =
      extra > 0 ? value.slice(0, STAFF_ASSISTANT_CLIP_ARRAY_MAX) : value;
    let omitted = extra;
    const preview: unknown[] = [];
    for (const entry of kept) {
      const clipped = clipUnknown(entry);
      preview.push(clipped.preview);
      omitted += clipped.omitted;
    }
    return { preview, omitted };
  }
  if (isRecord(value)) {
    const preview: Record<string, unknown> = {};
    let omitted = 0;
    for (const [key, entry] of Object.entries(value)) {
      const clipped = clipUnknown(entry);
      preview[key] = clipped.preview;
      omitted += clipped.omitted;
    }
    return { preview, omitted };
  }
  return { preview: value, omitted: 0 };
}

function shrinkPreview(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 3);
  }
  if (!isRecord(value)) {
    return value;
  }
  const shrunk: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (Array.isArray(entry)) {
      shrunk[key] = entry.slice(0, 3);
    } else if (isRecord(entry) || typeof entry === "string") {
      shrunk[key] = entry;
    } else if (
      typeof entry === "number" ||
      typeof entry === "boolean" ||
      entry === null
    ) {
      shrunk[key] = entry;
    }
  }
  return shrunk;
}

export function clipStaffAssistantToolResult(output: unknown): unknown {
  if (isStaffAssistantConfirmationOutput(output) || isTypedToolError(output)) {
    return output;
  }

  const clipped = clipUnknown(output);
  let preview = clipped.preview;
  let omitted = clipped.omitted;

  if (jsonLength(preview) > STAFF_ASSISTANT_CLIP_JSON_MAX) {
    preview = shrinkPreview(preview);
    omitted = Math.max(omitted, 1);
  }
  if (jsonLength(preview) > STAFF_ASSISTANT_CLIP_JSON_MAX) {
    preview = { truncated: true };
    omitted = Math.max(omitted, 1);
  }

  if (omitted === 0) {
    return output;
  }

  return {
    status: STAFF_ASSISTANT_CLIPPED_STATUS,
    preview,
    omitted,
  };
}
