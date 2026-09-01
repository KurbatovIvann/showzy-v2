/**
 * Cheap operational classifier for the staff loop (SHO-340). Chitchat and
 * off-topic turns skip the tool catalog. Fail-open: errors and empty
 * last-user-text attach tools. Never logs the user message.
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

export interface StaffAssistantGateResult {
  readonly operational: boolean;
  readonly usage: StaffAssistantTurnUsage;
}

export const staffAssistantGateOutputSchema = z.object({
  operational: z.boolean(),
});

export const STAFF_ASSISTANT_GATE_SYSTEM = `Classify the staff member's last message for the Shozee company assistant. Reply with JSON only.

operational true: they want to view or change this company's data, or they ask whether / how you can help with that work (any language).
operational false: greetings, small talk, weather, general knowledge, or anything with no company-work intent.

Company-work domains (Ukrainian or English):
${STAFF_ASSISTANT_PRODUCT_GLOSSARY}

Examples:
Привіт → false
Яка погода в Києві? → false
Створи новий прайс лист для лехи, ціни на 10% нижчі → true
Чи можеш ти створювати прайс-листи? → true
А з чим ти можеш допомогти ще? → true
Покажи активні замовлення → true
Скільки буде 2+2 → false

If you are unsure, operational true.`;

export async function classifyStaffAssistantTurn(options: {
  readonly model: LanguageModel;
  readonly lastUserText: string;
  readonly abortSignal?: AbortSignal;
}): Promise<StaffAssistantGateResult> {
  const trimmed = options.lastUserText.trim();
  if (trimmed === "") {
    return { operational: true, usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE };
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
      operational: result.output.operational,
      usage: staffAssistantTurnUsageFromUnknown(result.usage),
    };
  } catch {
    return { operational: true, usage: EMPTY_STAFF_ASSISTANT_TURN_USAGE };
  }
}
