/**
 * Cheap operational classifier for the staff loop (SHO-340). Chitchat and
 * off-topic turns skip the tool catalog. Fail-open: errors and empty
 * last-user-text attach tools. Never logs the user message.
 */
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS } from "./anthropic-options.js";

export const staffAssistantGateOutputSchema = z.object({
  operational: z.boolean(),
});

export const STAFF_ASSISTANT_GATE_SYSTEM = `Classify the staff member's last message for the Shozee company assistant. Reply with JSON only.

operational true: they want to view or change this company's data (orders, customers, catalog, pricing, documents, files, invites, company profile).
operational false: greetings, small talk, weather, general knowledge, what you can do, or anything off-topic.

If you are unsure, operational true.`;

export async function classifyStaffAssistantTurn(options: {
  readonly model: LanguageModel;
  readonly lastUserText: string;
  readonly abortSignal?: AbortSignal;
}): Promise<{ operational: boolean }> {
  const trimmed = options.lastUserText.trim();
  if (trimmed === "") {
    return { operational: true };
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
    return { operational: result.output.operational };
  } catch {
    return { operational: true };
  }
}
