import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Staff-panel Anthropic model. The API key comes from validated config
 * (`ServerConfig.ai`), never from `process.env` in this package. Callers
 * must not invoke this with a missing key — the SSE mount fails typed.
 */
export function createStaffLanguageModel(options: {
  readonly apiKey: string;
  readonly model: string;
}): LanguageModel {
  const anthropic = createAnthropic({ apiKey: options.apiKey });
  return anthropic(options.model);
}
