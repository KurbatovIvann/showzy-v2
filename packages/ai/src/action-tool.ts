import { anthropic } from "@ai-sdk/anthropic";
import { CoreInvariantError } from "@showzy/core/errors";
import type { ActionContract } from "@showzy/core/contract";
import { tool, type Tool, type ToolSet } from "ai";

import {
  STAFF_ASSISTANT_CACHE_PROVIDER_OPTIONS,
  STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
} from "./anthropic-options.js";

/**
 * Anthropic custom tool names (`@ai-sdk/anthropic` sends `tool.name`
 * unchanged) must match `^[a-zA-Z0-9_-]{1,128}$`. Action contracts keep
 * the dotted `module.verb` identity (`orders.list`); the ToolSet key is
 * the provider-safe mapping (`orders_list`). Mechanical adapter only —
 * not a new principal and not a `packages/core` patch.
 */
export const PROVIDER_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/** Always-in-context domain tools (no `deferLoading`). */
export const STAFF_ASSISTANT_HOT_ACTION_NAMES = [
  "orders.list",
  "orders.get",
  "catalog.listProducts",
  "customers.listCustomers",
] as const;

const HOT_ACTION_NAME_SET = new Set<string>(STAFF_ASSISTANT_HOT_ACTION_NAMES);

/** ToolSet key for Anthropic BM25 tool search (provider-executed). */
export const STAFF_ASSISTANT_TOOL_SEARCH_NAME = "tool_search_tool_bm25";

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
 * Operational catalogs include BM25 tool search; hot actions stay in
 * context; every other exposed action is `deferLoading`. `execute` still
 * receives `contract.name` (`orders.list`). Empty catalogs attach nothing
 * (chitchat). The HTTP mount injects `executeAction`; this helper never
 * fetches `/rpc`.
 */
export function staffAssistantTools(
  contracts: readonly ActionContract[],
  execute: ActionToolExecute,
): ToolSet {
  const tools: ToolSet = {};
  if (contracts.length === 0) {
    return tools;
  }

  tools[STAFF_ASSISTANT_TOOL_SEARCH_NAME] =
    anthropic.tools.toolSearchBm25_20251119();

  const byName = new Map<string, ActionContract>();
  for (const contract of contracts) {
    byName.set(contract.name, contract);
  }

  for (const hotName of STAFF_ASSISTANT_HOT_ACTION_NAMES) {
    const contract = byName.get(hotName);
    if (contract === undefined) {
      continue;
    }
    insertActionTool(tools, contract, execute);
  }

  for (const contract of contracts) {
    if (HOT_ACTION_NAME_SET.has(contract.name)) {
      continue;
    }
    insertActionTool(
      tools,
      contract,
      execute,
      STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
    );
  }

  markLastNonDeferredToolCacheBreakpoint(tools);
  return tools;
}

function insertActionTool(
  tools: ToolSet,
  contract: ActionContract,
  execute: ActionToolExecute,
  providerOptions?: typeof STAFF_ASSISTANT_DEFER_PROVIDER_OPTIONS,
): void {
  const providerName = toProviderToolName(contract.name);
  if (tools[providerName] !== undefined) {
    throw new CoreInvariantError(
      `duplicate provider tool name "${providerName}" for "${contract.name}"`,
    );
  }
  const aiTool = actionContractToTool(contract, execute);
  tools[providerName] =
    providerOptions === undefined ? aiTool : { ...aiTool, providerOptions };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeferredTool(tool: { readonly providerOptions?: unknown }): boolean {
  if (!isRecord(tool.providerOptions)) {
    return false;
  }
  const anthropicOptions = tool.providerOptions["anthropic"];
  return (
    isRecord(anthropicOptions) && anthropicOptions["deferLoading"] === true
  );
}

function markLastNonDeferredToolCacheBreakpoint(tools: ToolSet): void {
  const names = Object.keys(tools);
  for (let index = names.length - 1; index >= 0; index -= 1) {
    const lastName = names[index];
    if (lastName === undefined) {
      continue;
    }
    const lastTool = tools[lastName];
    if (lastTool === undefined || isDeferredTool(lastTool)) {
      continue;
    }
    tools[lastName] = {
      ...lastTool,
      providerOptions: {
        ...lastTool.providerOptions,
        ...STAFF_ASSISTANT_CACHE_PROVIDER_OPTIONS,
      },
    };
    return;
  }
}
