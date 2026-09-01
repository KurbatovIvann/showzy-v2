import type { ActionContract } from "@showzy/core/contract";
import { tool, type Tool } from "ai";

/**
 * Injected tool body. Tests fake `executeAction`. The adapter never calls
 * `/rpc` and never logs prompts or API keys.
 */
export type ActionToolExecute = (
  actionName: string,
  input: unknown,
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
    execute: async (input: unknown) => {
      const parsed: unknown = contract.input.parse(input);
      return execute(contract.name, parsed);
    },
  });
}
