/**
 * Cheap intent classifier for the staff loop (SHO-340 / SHO-404).
 * Chitchat skips the tool catalog. Capability and `other` keep today's
 * hot set + Anthropic BM25. A high-confidence single job intent forces
 * one terminal tool. Fail-open: errors, empty last-user-text, and
 * `confidence: "low"` attach the full catalog, not a wrong narrow set.
 * Never logs the user message. Do not add a second agent.
 */
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS } from "./anthropic-options.js";
import { STAFF_ASSISTANT_PRODUCT_GLOSSARY } from "./product-glossary.js";
import {
  EMPTY_STAFF_ASSISTANT_TURN_USAGE,
  staffAssistantTurnUsageFromUnknown,
  type StaffAssistantTurnUsage,
} from "./usage.js";

export const STAFF_ASSISTANT_GATE_MODES = [
  "chitchat",
  "capability",
  "job",
] as const;
export type StaffAssistantGateMode =
  (typeof STAFF_ASSISTANT_GATE_MODES)[number];

export const STAFF_ASSISTANT_GATE_JOB_INTENTS = [
  "orders_page",
  "orders_counts",
  "orders_create",
  "other",
] as const;
export type StaffAssistantJobIntent =
  (typeof STAFF_ASSISTANT_GATE_JOB_INTENTS)[number];

export const STAFF_ASSISTANT_GATE_CONFIDENCE = ["high", "low"] as const;
export type StaffAssistantGateConfidence =
  (typeof STAFF_ASSISTANT_GATE_CONFIDENCE)[number];

export const STAFF_ASSISTANT_FORCED_JOB_TOOL_NAMES = [
  "orders_list_page",
  "orders_list_counts",
  "orders_create",
] as const;
export type StaffAssistantForcedToolName =
  (typeof STAFF_ASSISTANT_FORCED_JOB_TOOL_NAMES)[number];

export const STAFF_ASSISTANT_JOB_INTENT_TOOLS = {
  orders_page: "orders_list_page",
  orders_counts: "orders_list_counts",
  orders_create: "orders_create",
} as const satisfies Record<
  Exclude<StaffAssistantJobIntent, "other">,
  StaffAssistantForcedToolName
>;

export interface StaffAssistantGateResult {
  readonly mode: StaffAssistantGateMode;
  readonly intent?: StaffAssistantJobIntent;
  readonly confidence: StaffAssistantGateConfidence;
  readonly usage: StaffAssistantTurnUsage;
}

export type StaffAssistantGateToolPolicy =
  | { readonly kind: "none" }
  | { readonly kind: "full" }
  | {
      readonly kind: "forced";
      readonly toolName: StaffAssistantForcedToolName;
    };

const FAIL_OPEN_GATE: Omit<StaffAssistantGateResult, "usage"> = {
  mode: "job",
  intent: "other",
  confidence: "low",
};

export const staffAssistantGateOutputSchema = z
  .object({
    mode: z.enum(STAFF_ASSISTANT_GATE_MODES),
    intent: z.enum(STAFF_ASSISTANT_GATE_JOB_INTENTS).optional(),
    confidence: z.enum(STAFF_ASSISTANT_GATE_CONFIDENCE),
  })
  .refine((value) => value.mode !== "job" || value.intent !== undefined, {
    message: "intent is required when mode is job",
  });

export const STAFF_ASSISTANT_GATE_SYSTEM = `Classify the staff member's last message for the Shozee company assistant. Reply with JSON only: mode, confidence, and intent when mode is job.

mode:
- chitchat: greetings, small talk, weather, general knowledge, or anything with no company-work intent.
- capability: they ask whether / how you can help with this company's work (any language), including “what can you do”.
- job: they want to view or change this company's data.

intent (only when mode is job):
- orders_page: show / list / latest order headers (a page), e.g. “show last 3 orders”.
- orders_counts: how many / counts / turnover / gross — not a page of rows, e.g. “how many orders today”.
- orders_create: create a new order, e.g. “create an order for …”.
- other: any other job, or mixed-domain utterances (orders together with price lists, customers, catalog, or other modules in one message).

confidence: high only when a single label is clear. low when unsure. Only a high-confidence single job intent (orders_page, orders_counts, or orders_create) may narrow tools. Mixed-domain → intent other. If you are unsure, mode job, intent other, confidence low.

Company-work domains (Ukrainian or English):
${STAFF_ASSISTANT_PRODUCT_GLOSSARY}

Examples:
Привіт → {"mode":"chitchat","confidence":"high"}
hello → {"mode":"chitchat","confidence":"high"}
Яка погода в Києві? → {"mode":"chitchat","confidence":"high"}
show last 3 orders → {"mode":"job","intent":"orders_page","confidence":"high"}
Покажи активні замовлення → {"mode":"job","intent":"orders_page","confidence":"high"}
how many orders today → {"mode":"job","intent":"orders_counts","confidence":"high"}
create an order for Леха → {"mode":"job","intent":"orders_create","confidence":"high"}
can you help with price lists? → {"mode":"capability","confidence":"high"}
Чи можеш ти створювати прайс-листи? → {"mode":"capability","confidence":"high"}
А з чим ти можеш допомогти ще? → {"mode":"capability","confidence":"high"}
Створи новий прайс лист для лехи, ціни на 10% нижчі → {"mode":"job","intent":"other","confidence":"high"}
Show last orders and create a price list → {"mode":"job","intent":"other","confidence":"high"}
Скільки буде 2+2 → {"mode":"chitchat","confidence":"high"}`;

export function staffAssistantGateToolPolicy(
  result: Pick<StaffAssistantGateResult, "mode" | "intent" | "confidence">,
): StaffAssistantGateToolPolicy {
  if (result.confidence !== "high") {
    return { kind: "full" };
  }
  if (result.mode === "chitchat") {
    return { kind: "none" };
  }
  if (result.mode === "job") {
    if (
      result.intent === "orders_page" ||
      result.intent === "orders_counts" ||
      result.intent === "orders_create"
    ) {
      return {
        kind: "forced",
        toolName: STAFF_ASSISTANT_JOB_INTENT_TOOLS[result.intent],
      };
    }
  }
  return { kind: "full" };
}

export async function classifyStaffAssistantTurn(options: {
  readonly model: LanguageModel;
  readonly lastUserText: string;
  readonly abortSignal?: AbortSignal;
}): Promise<StaffAssistantGateResult> {
  const trimmed = options.lastUserText.trim();
  if (trimmed === "") {
    return { ...FAIL_OPEN_GATE, usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE };
  }
  try {
    const result = await generateText({
      model: options.model,
      output: Output.object({ schema: staffAssistantGateOutputSchema }),
      system: STAFF_ASSISTANT_GATE_SYSTEM,
      prompt: trimmed,
      providerOptions: {
        anthropic: STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS,
      },
      ...(options.abortSignal !== undefined
        ? { abortSignal: options.abortSignal }
        : {}),
    });
    return {
      mode: result.output.mode,
      ...(result.output.intent !== undefined
        ? { intent: result.output.intent }
        : {}),
      confidence: result.output.confidence,
      usage: staffAssistantTurnUsageFromUnknown(result.usage),
    };
  } catch {
    return { ...FAIL_OPEN_GATE, usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE };
  }
}
