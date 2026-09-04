import type { ActionContract } from "@showzy/core/contract";
import { ConfirmationRequiredError, CoreError } from "@showzy/core/errors";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  Output,
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
  pickStaffAssistantForcedTool,
  staffAssistantTools,
  STAFF_ASSISTANT_TOOL_SEARCH_NAME,
  type ActionToolExecute,
} from "./action-tool.js";
import type { StaffAssistantForcedToolName } from "./gate.js";
import { STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS } from "./anthropic-options.js";
import { clipStaffAssistantToolResult } from "./clip-tool-result.js";
import {
  isStaffAssistantConfirmationOutput,
  type StaffAssistantConfirmationOutput,
} from "./confirmation.js";
import { staffAssistantJsonChars } from "./json-chars.js";
import { staffAssistantHistoryStats } from "./messages.js";
import {
  staffAssistantPersistedTurnText,
  staffAssistantTurnUsesCompletedPresenter,
  STAFF_ASSISTANT_DEFAULT_LOCALE,
  type StaffAssistantLocale,
  type StaffAssistantPresentedToolResult,
} from "./presenter.js";
import {
  createSpokenReplyUiTransform,
  isStaffAssistantSyntheticJsonTool,
  staffAssistantSpokenOutputSchema,
} from "./spoken-reply.js";
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
/**
 * Mechanical cap so a looping model cannot run unbounded tool steps.
 * Structured `{ spoken }` output is an extra step after tools (SHO-386).
 */
export const STAFF_ASSISTANT_MAX_STEPS = 9;

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

/**
 * Forced-job lifecycle: stop after a domain tool result (completed view,
 * `needs_choice`, `confirmation_required`, or `error`). Do not force a
 * second tool for presentation.
 */
function stepReachedForcedJobTerminal(
  steps: Array<StepResult<ToolSet>>,
): boolean {
  const last = steps.at(-1);
  if (last === undefined) {
    return false;
  }
  return last.toolResults.some(
    (result) => !isStaffAssistantSyntheticJsonTool(result.toolName),
  );
}

function domainToolRuns(
  runs: readonly StaffAssistantToolRun[],
): StaffAssistantToolRun[] {
  return runs.filter(
    (run) => !isStaffAssistantSyntheticJsonTool(run.actionName),
  );
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
function clipToolExecutes(
  tools: ToolSet,
  clipBytes: ClipByteMeter,
  presented: StaffAssistantPresentedToolResult[],
): void {
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
        const returned = meterToolResult(
          clipBytes,
          output,
          clipStaffAssistantToolResult(output),
        );
        presented.push({ toolName: name, output: returned });
        return returned;
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

const STAFF_ASSISTANT_PRESENTER_STREAM_TEXT_ID = "presenter";

function isStaffAssistantTextStreamPartType(type: string): boolean {
  return type === "text-start" || type === "text-delta" || type === "text-end";
}

/**
 * Drop model `{ spoken }` text parts when a registered completed surface
 * will replace the live bubble. Tool parts keep streaming.
 */
function createSuppressCompletedPresenterTextTransform<
  T extends { readonly type: string },
>(shouldSuppress: () => boolean): TransformStream<T, T> {
  return new TransformStream<T, T>({
    transform(part, controller) {
      if (shouldSuppress() && isStaffAssistantTextStreamPartType(part.type)) {
        return;
      }
      controller.enqueue(part);
    },
  });
}

async function writeUiMessageChunks<T>(
  writer: { write: (part: T) => void },
  stream: ReadableStream<T>,
): Promise<void> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      writer.write(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * AI SDK 7 staff-panel loop (ADR-0032). `execute` is injected so this
 * package never calls `/rpc`. ConfirmationRequiredError pauses the loop
 * and is streamed as a `data-confirmation` part (redacted summary only).
 * The Redis challenge remains core.md §7 — this does not auto-confirm.
 * When a registered completed surface exists, SSE `text-*` parts are the
 * presenter string (same as persist), not model `{ spoken }`.
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
  /**
   * Explicit presenter locale from the chat request. Legacy callers
   * omit this; default is Ukrainian.
   */
  readonly locale?: StaffAssistantLocale;
  /**
   * High-confidence job intent (SHO-404): attach only this ToolSet key
   * and `toolChoice: "required"`. Omit for today's hot set + BM25.
   */
  readonly forcedToolName?: StaffAssistantForcedToolName;
  /** Awaited inside the UI-message stream after `result.text`. A throw fails the stream. */
  readonly onTurn?: (turn: StaffAssistantTurnResult) => Promise<void>;
}): {
  readonly response: Response;
  readonly completion: Promise<StaffAssistantTurnResult>;
} {
  const runs: StaffAssistantToolRun[] = [];
  const presentedToolResults: StaffAssistantPresentedToolResult[] = [];
  const clipBytes: ClipByteMeter = { in: 0, out: 0 };
  const history = staffAssistantHistoryStats(options.messages);
  const locale = options.locale ?? STAFF_ASSISTANT_DEFAULT_LOCALE;
  const catalog = staffAssistantTools(
    options.contracts,
    wrapExecute(options.execute, runs),
  );
  const tools =
    options.forcedToolName !== undefined
      ? pickStaffAssistantForcedTool(catalog, options.forcedToolName)
      : catalog;
  const forceJobTool =
    options.forcedToolName !== undefined &&
    tools[options.forcedToolName] !== undefined;
  clipToolExecutes(tools, clipBytes, presentedToolResults);
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
        ...(forceJobTool ? { toolChoice: "required" as const } : {}),
        output: Output.object({ schema: staffAssistantSpokenOutputSchema }),
        providerOptions: {
          anthropic: STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS,
        },
        ...(options.abortSignal !== undefined
          ? { abortSignal: options.abortSignal }
          : {}),
        prepareStep: ({ steps }) => {
          if (!forceJobTool) {
            return undefined;
          }
          if (stepReachedForcedJobTerminal(steps)) {
            return { toolChoice: "none" as const };
          }
          if (steps.length === 0) {
            return { toolChoice: "required" as const };
          }
          return { toolChoice: "none" as const };
        },
        stopWhen: [
          ({ steps }) => steps.length >= STAFF_ASSISTANT_MAX_STEPS,
          ({ steps }) => stepRequestedConfirmation(steps),
          ({ steps }) => forceJobTool && stepReachedForcedJobTerminal(steps),
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
      await writeUiMessageChunks(
        writer,
        toUIMessageStream({
          stream: result.stream
            .pipeThrough(createSpokenReplyUiTransform({ runs }))
            .pipeThrough(
              createSuppressCompletedPresenterTextTransform(() =>
                staffAssistantTurnUsesCompletedPresenter({
                  locale,
                  toolResults: presentedToolResults,
                  runs,
                }),
              ),
            ),
          tools,
        }),
      );
      let parsedSpoken: string | undefined;
      try {
        parsedSpoken = (await result.output).spoken;
      } catch {
        parsedSpoken = undefined;
      }
      let rawText: string;
      try {
        rawText = await result.text;
      } catch {
        rawText = "The assistant could not complete this turn.";
      }
      const turn: StaffAssistantTurnResult = {
        text: staffAssistantPersistedTurnText({
          locale,
          toolResults: presentedToolResults,
          parsedSpoken,
          rawText,
          runs,
        }),
        toolRuns: domainToolRuns(runs).slice(0, STAFF_ASSISTANT_TOOL_RUNS_MAX),
        usage: await staffAssistantTurnUsageFromTotal(result.usage),
        toolsAttached: options.contracts.length > 0,
        modelSteps: await staffAssistantModelStepCount(result.steps),
        toolResultBytesIn: clipBytes.in,
        toolResultBytesOut: clipBytes.out,
        toolsetHash,
        historyMessageCount: history.messageCount,
        historyChars: history.chars,
      };
      if (
        staffAssistantTurnUsesCompletedPresenter({
          locale,
          toolResults: presentedToolResults,
          runs,
        })
      ) {
        const id = STAFF_ASSISTANT_PRESENTER_STREAM_TEXT_ID;
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: turn.text });
        writer.write({ type: "text-end", id });
      }
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
