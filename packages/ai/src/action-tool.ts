import type { ActionContract } from "@showzy/core/contract";
import { tool, type Tool, type ToolSet } from "ai";

/**
 * Injected tool body. Tests fake `executeAction`. The adapter never calls
 * `/rpc` and never logs prompts or API keys. `toolCallId` comes from the
 * AI SDK loop and is passed through to `executeAction` request meta.
 */
export type ActionToolExecute = (
  actionName: string,
  input: unknown,
  options: { readonly toolCallId: string },
) => Promise<unknown>;

/**
 * Wrap one `ActionContract` as an AI SDK 7 `tool()`. The registry `name`
 * and `description` are the tool identity; Zod `input` is the schema.
 * `execute` is injected so this package does not own the action pipeline.
 */
export function actionContractToTool(
  contract: ActionContract,
  execute: ActionToolExecute,
): Tool {
  return tool({
    description: contract.description,
    inputSchema: contract.input,
    execute: async (input: unknown, options) => {
      const parsed: unknown = contract.input.parse(input);
      return execute(contract.name, parsed, { toolCallId: options.toolCallId });
    },
  });
}

/**
 * Build the AI SDK tool map keyed by action name. The HTTP mount injects
 * `executeAction`; this helper never fetches `/rpc`.
 */
export function staffAssistantTools(
  contracts: readonly ActionContract[],
  execute: ActionToolExecute,
): ToolSet {
  const tools: ToolSet = {};
  for (const contract of contracts) {
    tools[contract.name] = actionContractToTool(contract, execute);
  }
  return tools;
}
