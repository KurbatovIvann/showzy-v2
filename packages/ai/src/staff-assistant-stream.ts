import type { ActionContract } from "@showzy/core/contract";
import { ConfirmationRequiredError, CoreError } from "@showzy/core/errors";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type ModelMessage,
  type StepResult,
  type ToolSet,
  type UIMessage,
} from "ai";
import { z } from "zod";

import {
  staffAssistantTools,
  STAFF_ASSISTANT_TOOL_SEARCH_NAME,
  type ActionToolExecute,
} from "./action-tool.js";
import { STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS } from "./anthropic-options.js";
import { clipStaffAssistantToolResult } from "./clip-tool-result.js";
import {
  isStaffAssistantConfirmationOutput,
  STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT,
  type StaffAssistantConfirmationOutput,
} from "./confirmation.js";
import { staffAssistantJsonChars } from "./json-chars.js";
import { staffAssistantHistoryStats } from "./messages.js";
import { staffAssistantSystemMessages } from "./system-prompt.js";
import { staffAssistantToolsetHash } from "./toolset-hash.js";
import { staffAssistantTurnContextAddendum } from "./turn-context.js";
import {
  staffAssistantTurnUsageFromTotal,
  type StaffAssistantTurnUsage,
} from "./usage.js";

export const STAFF_ASSISTANT_TOOL_RUNS_MAX = 50;
export const STAFF_ASSISTANT_RESULT_IDS_MAX = 50;
export const STAFF_ASSISTANT_TOOL_CALL_ID_MAX = 128;
/** Mechanical cap so a looping model cannot run unbounded tool steps. */
export const STAFF_ASSISTANT_MAX_STEPS = 8;

const uuidSchema = z.uuid();

const RESULT_ID_KEYS = [
  "id",
  "orderId",
  "customerId",
  "documentId",
  "conversationId",
  "messageId",
  "requestId",
  "fileId",
] as const;

export type StaffAssistantToolRunOutcome =
  "success" | "error" | "confirmation_required";

export interface StaffAssistantToolRun {
  readonly actionName: string;
  readonly toolCallId: string;
  readonly challengeId?: string;
  readonly resultIds: readonly string[];
  readonly outcome: StaffAssistantToolRunOutcome;
}

export interface StaffAssistantTurnResult {
  readonly text: string;
  readonly toolRuns: readonly StaffAssistantToolRun[];
  readonly usage: StaffAssistantTurnUsage;
  readonly toolsAttached: boolean;
  readonly modelSteps: number;
  readonly toolResultBytesIn: number;
  readonly toolResultBytesOut: number;
  readonly toolsetHash: string;
  readonly historyMessageCount: number;
  readonly historyChars: number;
}

export type StaffAssistantUIMessage = UIMessage<
  unknown,
  { confirmation: StaffAssistantConfirmationOutput }
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractUuidResultIds(output: unknown): string[] {
  if (!isRecord(output)) {
    return [];
  }
  const ids: string[] = [];
  for (const key of RESULT_ID_KEYS) {
    const value = output[key];
    if (typeof value === "string" && uuidSchema.safeParse(value).success) {
      ids.push(value);
    }
    if (ids.length >= STAFF_ASSISTANT_RESULT_IDS_MAX) {
      break;
    }
  }
  return ids;
}

function clipToolCallId(toolCallId: string): string {
  return toolCallId.slice(0, STAFF_ASSISTANT_TOOL_CALL_ID_MAX);
}

function confirmationFromError(
  error: ConfirmationRequiredError,
  actionName: string,
  toolCallId: string,
): StaffAssistantConfirmationOutput {
  return {
    status: "confirmation_required",
    challengeId: error.challenge.challengeId,
    summary: error.challenge.summary,
    expiresAt: error.challenge.expiresAt,
    actionName,
    toolCallId,
  };
}

function stepRequestedConfirmation(steps: Array<StepResult<ToolSet>>): boolean {
  const last = steps.at(-1);
  if (last === undefined) {
    return false;
  }
  return last.toolResults.some((result) =>
    isStaffAssistantConfirmationOutput(result.output),
  );
}

function turnText(
  text: string,
  runs: readonly StaffAssistantToolRun[],
): string {
  const trimmed = text.trim();
  if (trimmed !== "") {
    return trimmed;
  }
  if (runs.some((run) => run.outcome === "confirmation_required")) {
    return STAFF_ASSISTANT_CONFIRMATION_FALLBACK_TEXT;
  }
  return "Done.";
}

interface ClipByteMeter {
  in: number;
  out: number;
}

function meterToolResult(
  meter: ClipByteMeter,
  raw: unknown,
  returned: unknown,
): unknown {
  meter.in += staffAssistantJsonChars(raw);
  meter.out += staffAssistantJsonChars(returned);
  return returned;
}

function wrapExecute(
  execute: ActionToolExecute,
  runs: StaffAssistantToolRun[],
): ActionToolExecute {
  return async (actionName, input, options) => {
    const toolCallId = clipToolCallId(options.toolCallId);
    if (runs.length >= STAFF_ASSISTANT_TOOL_RUNS_MAX) {
      return {
        status: "error",
        code: "INTERNAL",
        message: "The assistant could not complete this turn.",
      };
    }
    try {
      const output: unknown = await execute(actionName, input, {
        toolCallId,
      });
      runs.push({
        actionName,
        toolCallId,
        resultIds: extractUuidResultIds(output),
        outcome: "success",
      });
      return output;
    } catch (error) {
      if (error instanceof ConfirmationRequiredError) {
        const confirmation = confirmationFromError(
          error,
          actionName,
          toolCallId,
        );
        runs.push({
          actionName,
          toolCallId,
          challengeId: confirmation.challengeId,
          resultIds: [],
          outcome: "confirmation_required",
        });
        return confirmation;
      }
      if (error instanceof CoreError) {
        runs.push({
          actionName,
          toolCallId,
          resultIds: [],
          outcome: "error",
        });
        return {
          status: "error",
          code: error.code,
          message: error.clientMessage,
        };
      }
      runs.push({
        actionName,
        toolCallId,
        resultIds: [],
        outcome: "error",
      });
      return {
        status: "error",
        code: "INTERNAL",
        message: "The assistant could not complete this turn.",
      };
    }
  };
}

/**
 * Clip the Tool execute return (after named façades map a compact view)
 * so catalog list prices are not stripped because images bloated the
 * executeAction payload. Persistence still records the registry output.
 */
function clipToolExecutes(tools: ToolSet, clipBytes: ClipByteMeter): void {
  for (const name of Object.keys(tools)) {
    if (name === STAFF_ASSISTANT_TOOL_SEARCH_NAME) {
      continue;
    }
    const aiTool = tools[name];
    if (aiTool === undefined || aiTool.execute === undefined) {
      continue;
    }
    const inner = aiTool.execute;
    tools[name] = {
      ...aiTool,
      execute: async (input, options) => {
        const output: unknown = await inner(input, options);
        return meterToolResult(
          clipBytes,
          output,
          clipStaffAssistantToolResult(output),
        );
      },
    };
  }
}

async function staffAssistantModelStepCount(
  steps: PromiseLike<unknown>,
): Promise<number> {
  try {
    const value = await steps;
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

/**
 * AI SDK 7 staff-panel loop (ADR-0032). `execute` is injected so this
 * package never calls `/rpc`. ConfirmationRequiredError pauses the loop
 * and is streamed as a `data-confirmation` part (redacted summary only).
 * The Redis challenge remains core.md §7 — this does not auto-confirm.
 */
export function streamStaffAssistantChat(options: {
  readonly model: LanguageModel;
  readonly messages: ModelMessage[];
  readonly contracts: readonly ActionContract[];
  readonly execute: ActionToolExecute;
  readonly abortSignal?: AbortSignal;
  readonly responseHeaders?: Record<string, string>;
  /**
   * Uncached second system message (clock always; company + working set
   * when the HTTP mount composed them). When omitted, a clock-only
   * addendum is generated for this turn.
   */
  readonly turnContextAddendum?: string;
  /** Awaited inside the UI-message stream after `result.text`. A throw fails the stream. */
  readonly onTurn?: (turn: StaffAssistantTurnResult) => Promise<void>;
}): {
  readonly response: Response;
  readonly completion: Promise<StaffAssistantTurnResult>;
} {
  const runs: StaffAssistantToolRun[] = [];
  const clipBytes: ClipByteMeter = { in: 0, out: 0 };
  const history = staffAssistantHistoryStats(options.messages);
  const tools = staffAssistantTools(
    options.contracts,
    wrapExecute(options.execute, runs),
  );
  clipToolExecutes(tools, clipBytes);
  const toolsetHash = staffAssistantToolsetHash(Object.keys(tools));

  let resolveCompletion!: (value: StaffAssistantTurnResult) => void;
  const completion = new Promise<StaffAssistantTurnResult>((resolve) => {
    resolveCompletion = resolve;
  });

  const stream = createUIMessageStream<StaffAssistantUIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model: options.model,
        system: staffAssistantSystemMessages(
          options.turnContextAddendum !== undefined &&
            options.turnContextAddendum !== ""
            ? options.turnContextAddendum
            : staffAssistantTurnContextAddendum({ now: new Date() }),
        ),
        messages: options.messages,
        tools,
        providerOptions: {
          anthropic: STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS,
        },
        ...(options.abortSignal !== undefined
          ? { abortSignal: options.abortSignal }
          : {}),
        stopWhen: [
          ({ steps }) => steps.length >= STAFF_ASSISTANT_MAX_STEPS,
          ({ steps }) => stepRequestedConfirmation(steps),
        ],
        onStepEnd: ({ toolResults }) => {
          for (const toolResult of toolResults) {
            if (isStaffAssistantConfirmationOutput(toolResult.output)) {
              writer.write({
                type: "data-confirmation",
                data: toolResult.output,
              });
            }
          }
        },
      });
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          tools,
        }),
      );
      let text: string;
      try {
        text = await result.text;
      } catch {
        text = "The assistant could not complete this turn.";
      }
      const turn: StaffAssistantTurnResult = {
        text: turnText(text, runs),
        toolRuns: runs.slice(0, STAFF_ASSISTANT_TOOL_RUNS_MAX),
        usage: await staffAssistantTurnUsageFromTotal(result.usage),
        toolsAttached: options.contracts.length > 0,
        modelSteps: await staffAssistantModelStepCount(result.steps),
        toolResultBytesIn: clipBytes.in,
        toolResultBytesOut: clipBytes.out,
        toolsetHash,
        historyMessageCount: history.messageCount,
        historyChars: history.chars,
      };
      resolveCompletion(turn);
      if (options.onTurn !== undefined) {
        await options.onTurn(turn);
      }
    },
    onError: () => "The assistant could not complete this turn.",
  });

  return {
    response: createUIMessageStreamResponse({
      stream,
      ...(options.responseHeaders !== undefined
        ? { headers: options.responseHeaders }
        : {}),
    }),
    completion,
  };
}
