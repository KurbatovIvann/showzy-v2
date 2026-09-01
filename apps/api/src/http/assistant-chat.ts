/**
 * Staff AI SSE mount (SHO-322 / feature SHO-318, ADR-0003, ADR-0032).
 *
 * `POST /assistant/chat` is a dedicated Hono route — not `/rpc`. Session
 * cookie + `x-company-id` match other staff HTTP. Membership is verified
 * by `executeAction` (`assistant.getStaffActor`), never by the selector.
 * Tool `execute` calls `executeAction` with `channel: "ai"`; the adapter
 * never fetches `/rpc`. Missing Anthropic config fails typed after auth;
 * the process still boots.
 */
import {
  createStaffLanguageModel,
  filterStaffAiTools,
  lastStaffAssistantUserText,
  pausedActionNameForChallenge,
  StaffAssistantNotConfiguredError,
  staffAssistantChatBodySchema,
  staffAssistantModelMessages,
  streamStaffAssistantChat,
  type LanguageModel,
  type StaffAssistantChatMessage,
  type StaffAssistantTurnResult,
} from "@showzy/ai";
import {
  appendUserMessage,
  getConversation,
  getStaffActor,
  recordAssistantTurn,
} from "@showzy/assistant";
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
} from "@showzy/contract";
import { toWireError } from "@showzy/contract/server";
import {
  canonicalJsonSha256,
  executeAction,
  type ActionPipelineDeps,
  type ActionRegistry,
  type ImplementedAction,
  type JsonSerializable,
  type SessionPrincipal,
} from "@showzy/core";
import {
  CoreError,
  CoreInvariantError,
  ValidationError,
} from "@showzy/core/errors";
import type { Logger } from "pino";
import type { z } from "zod";

import { REQUEST_ID_HEADER } from "./request-id.js";

export const ASSISTANT_CHAT_PATH = "/assistant/chat";

export const ASSISTANT_INVOCATION_CHANNEL = "ai" as const;

export interface StaffAssistantRuntime {
  readonly model: string;
  readonly anthropicApiKey?: string;
  /** Tests inject MockLanguageModelV3 — never a live LLM in CI. */
  readonly languageModel?: LanguageModel;
}

export interface StaffAssistantChatOptions {
  readonly request: Request;
  readonly requestId: string;
  readonly clientIp: string;
  readonly registry: ActionRegistry;
  readonly pipeline: ActionPipelineDeps;
  readonly getSession: (headers: Headers) => Promise<SessionPrincipal | null>;
  readonly assistant?: StaffAssistantRuntime;
}

function headerOrNull(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value === null || value === "" ? null : value;
}

function optionalHeader(headers: Headers, name: string): string | undefined {
  const value = headers.get(name);
  return value === null || value === "" ? undefined : value;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  requestId: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

function unauthenticatedResponse(requestId: string): Response {
  return jsonResponse(
    401,
    {
      code: "UNAUTHENTICATED",
      status: 401,
      message: "Authentication required.",
    },
    requestId,
  );
}

function wireResponse(error: unknown, requestId: string): Response {
  if (error instanceof StaffAssistantNotConfiguredError) {
    return jsonResponse(
      503,
      {
        code: error.code,
        status: 503,
        message: error.message,
      },
      requestId,
    );
  }
  const wire = toWireError(error);
  const body: Record<string, unknown> = {
    code: wire.code,
    status: wire.status,
    message: wire.message,
  };
  if (wire.data !== undefined) {
    body.data = wire.data;
  }
  return jsonResponse(wire.status, body, requestId);
}

function logFailure(logger: Logger, requestId: string, code: string): void {
  logger.error({ request_id: requestId, code }, "staff assistant chat failed");
}

function failureCode(error: unknown): string {
  if (error instanceof StaffAssistantNotConfiguredError) {
    return error.code;
  }
  if (error instanceof CoreError) {
    return error.code;
  }
  return "INTERNAL";
}

function resolveLanguageModel(
  assistant: StaffAssistantRuntime | undefined,
): LanguageModel {
  if (assistant?.languageModel !== undefined) {
    return assistant.languageModel;
  }
  if (
    assistant !== undefined &&
    assistant.anthropicApiKey !== undefined &&
    assistant.anthropicApiKey !== ""
  ) {
    return createStaffLanguageModel({
      apiKey: assistant.anthropicApiKey,
      model: assistant.model,
    });
  }
  throw new StaffAssistantNotConfiguredError();
}

function requireImplementation(
  registry: ActionRegistry,
  name: string,
): ImplementedAction<z.ZodType, z.ZodType, unknown> {
  const implementation = registry.getImplementation(name);
  if (implementation === undefined) {
    throw new CoreInvariantError(
      `staff assistant tool "${name}" is not registered`,
    );
  }
  // The registry erases callback generics so a stored implementation
  // cannot be invoked without pipeline validation (fnd-T9). The
  // pipeline is exactly what runs here, and every registry entry is an
  // `implementAction` output, so restoring the erased shape is sound.
  return implementation as ImplementedAction<z.ZodType, z.ZodType, unknown>;
}

function pausedActionNameFromToolRuns(
  toolRuns: readonly {
    readonly actionName: string;
    readonly challengeId: string | null;
    readonly outcome: string;
  }[],
  challengeId: string,
): string | undefined {
  for (let index = toolRuns.length - 1; index >= 0; index -= 1) {
    const run = toolRuns[index];
    if (
      run !== undefined &&
      run.outcome === "confirmation_required" &&
      run.challengeId === challengeId
    ) {
      return run.actionName;
    }
  }
  return undefined;
}

async function parseChatBody(request: Request): Promise<{
  conversationId: string;
  messages: StaffAssistantChatMessage[];
}> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError([
      {
        code: "custom",
        path: [],
        message: "Request body must be JSON.",
        input: undefined,
      },
    ]);
  }
  const parsed = staffAssistantChatBodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues);
  }
  return parsed.data;
}

function staffRequest(options: {
  readonly requestId: string;
  readonly clientIp: string;
  readonly aiTraceId: string;
  readonly toolCallId?: string;
  readonly idempotencyKey?: string;
  readonly confirmationChallengeId?: string;
}) {
  return {
    requestId: options.requestId,
    correlationId: options.requestId,
    channel: ASSISTANT_INVOCATION_CHANNEL,
    clientIp: options.clientIp,
    aiTraceId: options.aiTraceId,
    ...(options.toolCallId !== undefined
      ? { toolCallId: options.toolCallId }
      : {}),
    ...(options.idempotencyKey !== undefined
      ? { idempotencyKey: options.idempotencyKey }
      : {}),
    ...(options.confirmationChallengeId !== undefined
      ? { confirmationChallengeId: options.confirmationChallengeId }
      : {}),
  };
}

/**
 * Handle `POST /assistant/chat`. Auth denial happens before model
 * construction so a missing Anthropic key cannot mask 401.
 */
export async function executeStaffAssistantChat(
  options: StaffAssistantChatOptions,
): Promise<Response> {
  const session = await options.getSession(options.request.headers);
  if (session === null) {
    return unauthenticatedResponse(options.requestId);
  }

  const companySelector = headerOrNull(
    options.request.headers,
    COMPANY_SELECTOR_HEADER,
  );
  const confirmationChallengeId = optionalHeader(
    options.request.headers,
    CONFIRMATION_CHALLENGE_HEADER,
  );
  const aiTraceId = options.requestId;
  const staffPrincipal = {
    mode: "staff" as const,
    session,
    companySelector,
  };
  const baseRequest = staffRequest({
    requestId: options.requestId,
    clientIp: options.clientIp,
    aiTraceId,
  });

  try {
    const actor = await executeAction(options.pipeline, {
      action: getStaffActor,
      input: {},
      request: baseRequest,
      principal: staffPrincipal,
    });

    const model = resolveLanguageModel(options.assistant);
    const body = await parseChatBody(options.request);
    const userText = lastStaffAssistantUserText(body.messages);
    if (userText === undefined && confirmationChallengeId === undefined) {
      throw new ValidationError([
        {
          code: "custom",
          path: ["messages"],
          message: "A user message is required.",
          input: undefined,
        },
      ]);
    }

    const modelMessages = staffAssistantModelMessages(body.messages);
    if (modelMessages.length === 0) {
      throw new ValidationError([
        {
          code: "custom",
          path: ["messages"],
          message: "A user message is required.",
          input: undefined,
        },
      ]);
    }

    if (userText !== undefined) {
      await executeAction(options.pipeline, {
        action: appendUserMessage,
        input: {
          conversationId: body.conversationId,
          body: userText,
        },
        request: staffRequest({
          requestId: options.requestId,
          clientIp: options.clientIp,
          aiTraceId,
          idempotencyKey: canonicalJsonSha256({
            kind: "assistant.appendUserMessage",
            conversationId: body.conversationId,
            body: userText,
          }),
        }),
        principal: staffPrincipal,
      });
    }

    let pausedActionName =
      confirmationChallengeId !== undefined
        ? pausedActionNameForChallenge(body.messages, confirmationChallengeId)
        : undefined;
    if (
      confirmationChallengeId !== undefined &&
      pausedActionName === undefined
    ) {
      const conversation = await executeAction(options.pipeline, {
        action: getConversation,
        input: { conversationId: body.conversationId },
        request: baseRequest,
        principal: staffPrincipal,
      });
      pausedActionName = pausedActionNameFromToolRuns(
        conversation.toolRuns,
        confirmationChallengeId,
      );
    }

    const contracts = filterStaffAiTools(options.registry.contracts(), {
      role: actor.role,
      permissions: actor.permissions,
    });

    const { response } = streamStaffAssistantChat({
      model,
      messages: modelMessages,
      contracts,
      abortSignal: options.request.signal,
      responseHeaders: {
        "cache-control": "private, no-store",
        [REQUEST_ID_HEADER]: options.requestId,
      },
      execute: (actionName, input, toolOptions) => {
        const action = requireImplementation(options.registry, actionName);
        const idempotencyKey = action.contract.idempotent
          ? canonicalJsonSha256({
              kind: "assistant.tool",
              conversationId: body.conversationId,
              actionName,
              input: input as JsonSerializable,
            })
          : undefined;
        const bindConfirmation =
          confirmationChallengeId !== undefined &&
          pausedActionName !== undefined &&
          action.contract.requiresConfirmation &&
          action.contract.name === pausedActionName;
        return executeAction(options.pipeline, {
          action,
          input,
          request: staffRequest({
            requestId: options.requestId,
            clientIp: options.clientIp,
            aiTraceId,
            toolCallId: toolOptions.toolCallId,
            ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
            ...(bindConfirmation ? { confirmationChallengeId } : {}),
          }),
          principal: staffPrincipal,
        });
      },
      onTurn: async (turn) => {
        try {
          await persistAssistantTurn({
            pipeline: options.pipeline,
            conversationId: body.conversationId,
            requestId: options.requestId,
            clientIp: options.clientIp,
            aiTraceId,
            principal: staffPrincipal,
            turn,
          });
        } catch (error: unknown) {
          logFailure(
            options.pipeline.logger,
            options.requestId,
            failureCode(error),
          );
          throw error;
        }
      },
    });

    return response;
  } catch (error) {
    logFailure(options.pipeline.logger, options.requestId, failureCode(error));
    return wireResponse(error, options.requestId);
  }
}

async function persistAssistantTurn(options: {
  readonly pipeline: ActionPipelineDeps;
  readonly conversationId: string;
  readonly requestId: string;
  readonly clientIp: string;
  readonly aiTraceId: string;
  readonly principal: {
    readonly mode: "staff";
    readonly session: SessionPrincipal;
    readonly companySelector: string | null;
  };
  readonly turn: StaffAssistantTurnResult;
}): Promise<void> {
  await executeAction(options.pipeline, {
    action: recordAssistantTurn,
    input: {
      conversationId: options.conversationId,
      body: options.turn.text,
      toolRuns: options.turn.toolRuns.map((run) => ({
        actionName: run.actionName,
        toolCallId: run.toolCallId,
        ...(run.challengeId !== undefined
          ? { challengeId: run.challengeId }
          : {}),
        resultIds: [...run.resultIds],
        outcome: run.outcome,
      })),
    },
    request: staffRequest({
      requestId: options.requestId,
      clientIp: options.clientIp,
      aiTraceId: options.aiTraceId,
      idempotencyKey: canonicalJsonSha256({
        kind: "assistant.recordAssistantTurn",
        conversationId: options.conversationId,
        requestId: options.requestId,
      }),
    }),
    principal: options.principal,
  });
}
