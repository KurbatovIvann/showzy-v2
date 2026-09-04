/**
 * Spoken reply envelope for the staff assistant (SHO-386 / SHO-383 T3).
 *
 * `Output.object` here is a **reply envelope only** — `{ spoken }` — not
 * card protocol. Cards stay a projection of tool parts (ADR-0011). Prompt
 * lines are copied by hand from T2 mobile `promptLine`s; do not import
 * `apps/mobile`.
 */
import { z } from "zod";

import { STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT } from "./confirmation.js";

/**
 * Copied from `apps/mobile/.../surfaces/orders-list.ts`
 * `ORDERS_LIST_PROMPT_LINE`. Do not import mobile.
 */
export const ORDERS_LIST_PROMPT_LINE =
  "After orders_list_page (chips from same-turn orders_list_counts), the UI already shows the orders list card. Reply with a short product-language summary. Do not dump a markdown table of the rows.";

/**
 * Copied from `apps/mobile/.../surfaces/orders-aggregate.ts`
 * `ORDERS_AGGREGATE_PROMPT_LINE`. Do not import mobile.
 */
export const ORDERS_AGGREGATE_PROMPT_LINE =
  "After orders_list_counts with no page on the same turn, the UI already shows the orders aggregate card with period, totals, and a status breakdown. Reply with a short product-language summary of the totals. Do not dump a markdown table of buckets. Do not call orders_list_counts or orders.list again for the card.";

/**
 * Copied from `apps/mobile/.../surfaces/order-entity.ts`
 * `ORDER_ENTITY_PROMPT_LINE`. Do not import mobile.
 */
export const ORDER_ENTITY_PROMPT_LINE =
  "After orders.get or orders.create, the UI already shows an order entity card. Reply with a short product-language summary. Do not dump tool JSON.";

/** Anthropic json-tool / structured-output synthetic name. Not a domain action. */
export const STAFF_ASSISTANT_SYNTHETIC_JSON_TOOL_NAME = "json";

/**
 * Short product-language line when spoken is empty or a markdown dump
 * after a successful tool turn. Never "Done." for a successful list.
 */
export const STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK =
  "Here is a short summary of the result.";

/** `{ spoken }` only — no rows, cards, kinds, money, or order payloads. */
export const staffAssistantSpokenOutputSchema = z.strictObject({
  spoken: z.string(),
});

export type StaffAssistantSpokenOutput = z.output<
  typeof staffAssistantSpokenOutputSchema
>;

type SpokenTurnRun = {
  readonly outcome:
    "success" | "error" | "confirmation_required" | "choice_required";
};

type SpokenStreamPart = {
  readonly type: string;
  readonly id?: string;
  readonly text?: string;
  readonly toolName?: string;
  readonly toolCallId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStaffAssistantSyntheticJsonTool(name: string): boolean {
  return name === STAFF_ASSISTANT_SYNTHETIC_JSON_TOOL_NAME;
}

export function spokenContainsMarkdownDump(spoken: string): boolean {
  return (
    spoken.includes("|") || spoken.includes("**") || spoken.includes("```")
  );
}

/**
 * Parse a complete `{ "spoken": "..." }` model text. Undefined when the
 * model wrote prose (fail-open) or HITL skipped the JSON step.
 */
export function spokenFromModelText(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed === "") {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isRecord(parsed) && typeof parsed["spoken"] === "string") {
      return parsed["spoken"];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Best-effort `spoken` prefix from complete or partial JSON so the UI
 * stream can emit prose instead of `{"spoken":…}`.
 */
export function spokenPrefixFromPartialJson(text: string): string | undefined {
  const complete = spokenFromModelText(text);
  if (complete !== undefined) {
    return complete;
  }
  const key = '"spoken"';
  const keyIndex = text.indexOf(key);
  if (keyIndex < 0) {
    return undefined;
  }
  const afterKey = text.slice(keyIndex + key.length);
  const colon = afterKey.indexOf(":");
  if (colon < 0) {
    return undefined;
  }
  const rest = afterKey.slice(colon + 1).trimStart();
  if (!rest.startsWith('"')) {
    return undefined;
  }
  let spoken = "";
  for (let index = 1; index < rest.length; index += 1) {
    const char = rest[index];
    if (char === undefined) {
      break;
    }
    if (char === "\\") {
      const next = rest[index + 1];
      if (next === undefined) {
        break;
      }
      spoken += unescapeJsonChar(next);
      index += 1;
      continue;
    }
    if (char === '"') {
      break;
    }
    spoken += char;
  }
  return spoken;
}

function unescapeJsonChar(escaped: string): string {
  switch (escaped) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    case "r":
      return "\r";
    case '"':
      return '"';
    case "\\":
      return "\\";
    default:
      return escaped;
  }
}

function looksLikeJsonObject(text: string): boolean {
  return text.trimStart().startsWith("{");
}

export function spokenTurnText(options: {
  readonly parsedSpoken: string | undefined;
  readonly rawText: string;
  readonly runs: readonly SpokenTurnRun[];
}): string {
  const fromParsed = sanitizeSpoken(options.parsedSpoken, options.runs);
  if (fromParsed !== undefined) {
    return fromParsed;
  }
  const fromRaw = sanitizeSpoken(
    spokenFromModelText(options.rawText),
    options.runs,
  );
  if (fromRaw !== undefined) {
    return fromRaw;
  }
  const trimmed = options.rawText.trim();
  if (trimmed !== "" && !looksLikeJsonObject(trimmed)) {
    // Output.object parse failure can leave a markdown table as plain text.
    return sanitizeSpoken(trimmed, options.runs) ?? trimmed;
  }
  if (
    options.runs.some(
      (run) =>
        run.outcome === "confirmation_required" ||
        run.outcome === "choice_required",
    )
  ) {
    return STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT;
  }
  if (options.runs.some((run) => run.outcome === "success")) {
    return STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK;
  }
  return "Done.";
}

/**
 * Markdown `{ spoken }` fail-open. HITL on the same turn must win over a
 * prior successful tool (do not show a short success summary while a
 * confirmation card is active). Never `"Done."` here.
 */
function spokenMarkdownDumpFallback(runs: readonly SpokenTurnRun[]): string {
  if (
    runs.some(
      (run) =>
        run.outcome === "confirmation_required" ||
        run.outcome === "choice_required",
    )
  ) {
    return STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT;
  }
  return STAFF_ASSISTANT_SUCCESS_SPOKEN_FALLBACK;
}

function sanitizeSpoken(
  spoken: string | undefined,
  runs: readonly SpokenTurnRun[],
): string | undefined {
  if (spoken === undefined) {
    return undefined;
  }
  const trimmed = spoken.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (!spokenContainsMarkdownDump(trimmed)) {
    return trimmed;
  }
  return spokenMarkdownDumpFallback(runs);
}

function syntheticJsonNameFromPart(part: SpokenStreamPart): string | null {
  if (typeof part.toolName === "string" && part.toolName.length > 0) {
    return part.toolName;
  }
  const prefix = "tool-";
  if (part.type.startsWith(prefix) && part.type.length > prefix.length) {
    return part.type.slice(prefix.length);
  }
  return null;
}

/**
 * Flatten `{ spoken }` JSON text-deltas to prose and drop Anthropic
 * synthetic `json` tool parts so `useChat` never shows raw envelope JSON.
 */
export function createSpokenReplyUiTransform<
  T extends SpokenStreamPart,
>(options?: {
  readonly runs?: readonly SpokenTurnRun[];
}): TransformStream<T, T> {
  let accumulatedJson = "";
  let publishedSpoken = "";
  let heldMarkdownTextEnd: T | undefined;
  const droppedCallIds = new Set<string>();

  const emitHeldMarkdownFailOpen = (
    controller: TransformStreamDefaultController<T>,
  ) => {
    if (heldMarkdownTextEnd === undefined) {
      return;
    }
    const held = heldMarkdownTextEnd;
    heldMarkdownTextEnd = undefined;
    controller.enqueue({
      ...held,
      type: "text-delta",
      text: spokenMarkdownDumpFallback(options?.runs ?? []),
    });
    controller.enqueue(held);
  };

  return new TransformStream<T, T>({
    transform(part, controller) {
      const syntheticName = syntheticJsonNameFromPart(part);
      if (
        syntheticName !== null &&
        isStaffAssistantSyntheticJsonTool(syntheticName)
      ) {
        if (typeof part.id === "string" && part.id.length > 0) {
          droppedCallIds.add(part.id);
        }
        if (typeof part.toolCallId === "string" && part.toolCallId.length > 0) {
          droppedCallIds.add(part.toolCallId);
        }
        return;
      }
      const callId = part.toolCallId ?? part.id;
      if (
        typeof callId === "string" &&
        callId.length > 0 &&
        droppedCallIds.has(callId) &&
        part.type !== "text-delta" &&
        part.type !== "text-start" &&
        part.type !== "text-end"
      ) {
        return;
      }

      if (part.type === "text-start") {
        emitHeldMarkdownFailOpen(controller);
        accumulatedJson = "";
        publishedSpoken = "";
        controller.enqueue(part);
        return;
      }

      if (part.type === "text-delta") {
        const delta = typeof part.text === "string" ? part.text : "";
        accumulatedJson += delta;
        const spoken = spokenPrefixFromPartialJson(accumulatedJson);
        if (spoken === undefined || spokenContainsMarkdownDump(spoken)) {
          return;
        }
        if (!spoken.startsWith(publishedSpoken)) {
          publishedSpoken = spoken;
          controller.enqueue({ ...part, text: spoken });
          return;
        }
        const next = spoken.slice(publishedSpoken.length);
        publishedSpoken = spoken;
        if (next.length === 0) {
          return;
        }
        controller.enqueue({ ...part, text: next });
        return;
      }

      if (part.type === "text-end") {
        if (publishedSpoken === "" && accumulatedJson.trim() !== "") {
          if (!looksLikeJsonObject(accumulatedJson)) {
            if (spokenContainsMarkdownDump(accumulatedJson)) {
              // Same delay as JSON `{ spoken }` dumps so HITL can still win.
              heldMarkdownTextEnd = part;
              return;
            }
            controller.enqueue({
              ...part,
              type: "text-delta",
              text: accumulatedJson,
            });
          } else {
            const parsed = spokenFromModelText(accumulatedJson);
            if (parsed !== undefined && spokenContainsMarkdownDump(parsed)) {
              // Delay until flush so a later same-step confirmation_required
              // tool result can win over the successful-list markdown fail-open.
              heldMarkdownTextEnd = part;
              return;
            }
          }
        }
        controller.enqueue(part);
        return;
      }

      controller.enqueue(part);
    },
    flush(controller) {
      emitHeldMarkdownFailOpen(controller);
    },
  });
}
