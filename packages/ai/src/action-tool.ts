import { CoreInvariantError } from "@showzy/core/errors";
import type { ActionContract } from "@showzy/core/contract";
import { tool, type Tool, type ToolSet } from "ai";

/**
 * Anthropic custom tool names (`@ai-sdk/anthropic` sends `tool.name`
 * unchanged) must match `^[a-zA-Z0-9_-]{1,128}$`. Action contracts keep
 * the dotted `module.verb` identity (`orders.list`); the ToolSet key is
 * the provider-safe mapping (`orders_list`). Mechanical adapter only —
 * not a new principal and not a `packages/core` patch.
 */
export const PROVIDER_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

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
 * Map `orders.list` → `orders_list`. `defineActionContract` requires
 * exactly one dot and alphanumeric camelCase segments, so replacing `.`
 * with `_` is lossless.
 */
export function toProviderToolName(actionName: string): string {
  const providerName = actionName.replaceAll(".", "_");
  if (!PROVIDER_TOOL_NAME_PATTERN.test(providerName)) {
    throw new CoreInvariantError(
      `action "${actionName}" does not map to an Anthropic-safe tool name`,
    );
  }
  return providerName;
}

/** Inverse of `toProviderToolName` (`orders_list` → `orders.list`). */
export function fromProviderToolName(providerName: string): string {
  return providerName.replace("_", ".");
}

/**
 * Wrap one `ActionContract` as an AI SDK 7 `tool()`. The registry `name`
 * and `description` are the executeAction identity; Zod `input` is the
 * schema. `execute` is injected so this package does not own the action
 * pipeline. Provider-safe ToolSet keys are applied by
 * `staffAssistantTools`.
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
 * Build the AI SDK tool map keyed by the Anthropic-safe provider name.
 * `execute` still receives `contract.name` (`orders.list`). The HTTP
 * mount injects `executeAction`; this helper never fetches `/rpc`.
 */
export function staffAssistantTools(
  contracts: readonly ActionContract[],
  execute: ActionToolExecute,
): ToolSet {
  const tools: ToolSet = {};
  for (const contract of contracts) {
    const providerName = toProviderToolName(contract.name);
    if (tools[providerName] !== undefined) {
      throw new CoreInvariantError(
        `duplicate provider tool name "${providerName}" for "${contract.name}"`,
      );
    }
    tools[providerName] = actionContractToTool(contract, execute);
  }
  return tools;
}
