/**
 * Authenticated choice resume and safe peek (SHO-418 / T8a HTTP).
 * Cookie + `x-company-id` are headers — never action input. Body is
 * `{ conversationId, choiceId, optionId }` only.
 *
 * Successful interaction envelopes (`status` string) are decoded
 * separately from HTTP/Core error envelopes (`status` number).
 */
import { fetch as expoFetch } from "expo/fetch";
import { isWireError } from "@showzy/contract";
import { z } from "zod";

import {
  envelopeFromChoicePeek,
  type StaffAssistantChoiceCardEnvelope,
} from "../shared/choice";
import {
  deriveChoiceSelectRecoverability,
  type ChoiceSelectRecoverability,
  type ChoiceSelectResult,
} from "../shared/choice-presenter";
import { staffAssistantChatHeaders } from "./assistant-chat-headers";

export const ASSISTANT_CHOICE_PATH = "/assistant/choice";

const choiceInteractionResultSchema = z.object({
  status: z.enum(["completed", "needs_choice", "expired", "error"]),
  text: z.string().optional(),
  challengeId: z.uuid().optional(),
  reason: z.string().optional(),
  choiceKind: z.enum(["variant", "product", "customer"]).optional(),
  productName: z.string().optional(),
  options: z
    .array(z.object({ id: z.uuid(), label: z.string().min(1) }))
    .optional(),
  optionsTruncated: z.boolean().optional(),
  entity: z
    .object({ orderId: z.uuid(), orderNumber: z.string().min(1) })
    .optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

const coreWireErrorBodySchema = z.object({
  code: z.string().min(1),
  status: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

export type AssistantChoicePeekResult =
  | {
      readonly kind: "envelope";
      readonly envelope: StaffAssistantChoiceCardEnvelope;
    }
  | {
      readonly kind: "unavailable";
      readonly recoverability: "retryable" | "ambiguous";
      readonly httpStatus?: number;
      readonly code?: string;
    };

function assistantOrigin(apiOrigin: string): string {
  return apiOrigin.replace(/\/+$/, "");
}

export function assistantChoiceUrl(apiOrigin: string): string {
  return `${assistantOrigin(apiOrigin)}${ASSISTANT_CHOICE_PATH}`;
}

export function assistantChoicePeekUrl(
  apiOrigin: string,
  choiceId: string,
  conversationId: string,
): string {
  const base = assistantChoiceUrl(apiOrigin);
  return `${base}/${choiceId}?conversationId=${encodeURIComponent(conversationId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function retryAfterSecFrom(
  response: Response,
  data: unknown,
): number | undefined {
  if (isRecord(data) && typeof data.retryAfterSec === "number") {
    const fromData = data.retryAfterSec;
    if (Number.isFinite(fromData) && fromData >= 0) {
      return fromData;
    }
  }
  const header = response.headers.get("Retry-After");
  if (header === null || header === "") {
    return undefined;
  }
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }
  return seconds;
}

function withRecoverability(
  result: Omit<ChoiceSelectResult, "recoverability">,
): ChoiceSelectResult {
  return {
    ...result,
    recoverability: deriveChoiceSelectRecoverability(result),
  };
}

function httpFailureRecoverability(
  httpStatus: number,
): "retryable" | "ambiguous" {
  if (
    httpStatus === 408 ||
    httpStatus === 429 ||
    httpStatus === 502 ||
    httpStatus === 503 ||
    httpStatus === 504 ||
    (httpStatus >= 500 && httpStatus <= 599)
  ) {
    return "retryable";
  }
  if (httpStatus === 409) {
    return "ambiguous";
  }
  return "ambiguous";
}

function selectResultFromWireError(
  response: Response,
  raw: unknown,
): ChoiceSelectResult {
  const retryAfterSec = retryAfterSecFrom(
    response,
    isRecord(raw) ? raw.data : undefined,
  );
  if (isWireError(raw)) {
    return withRecoverability({
      status: "error",
      code: raw.code,
      message: raw.message,
      httpStatus: response.status,
      ...(retryAfterSec === undefined ? {} : { retryAfterSec }),
    });
  }
  const parsed = coreWireErrorBodySchema.safeParse(raw);
  if (parsed.success) {
    return withRecoverability({
      status: "error",
      code: parsed.data.code,
      message: parsed.data.message,
      httpStatus: response.status,
      ...(retryAfterSec === undefined ? {} : { retryAfterSec }),
    });
  }
  const code =
    isRecord(raw) && typeof raw.code === "string" ? raw.code : undefined;
  return withRecoverability({
    status: "error",
    ...(code === undefined ? {} : { code }),
    httpStatus: response.status,
    ...(retryAfterSec === undefined ? {} : { retryAfterSec }),
  });
}

async function readJsonBody(
  response: Response,
): Promise<
  { readonly ok: true; readonly value: unknown } | { readonly ok: false }
> {
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false };
  }
}

function malformedSelectResult(
  httpStatus: number | undefined,
  recoverability: ChoiceSelectRecoverability,
): ChoiceSelectResult {
  return {
    status: "error",
    ...(httpStatus === undefined ? {} : { httpStatus }),
    recoverability,
  };
}

export async function postAssistantChoice(args: {
  readonly apiUrl: string;
  readonly getCookie: () => string | null;
  readonly getCompanyId: () => string | null;
  readonly conversationId: string;
  readonly choiceId: string;
  readonly optionId: string;
}): Promise<ChoiceSelectResult> {
  let response: Response;
  try {
    response = await expoFetch(assistantChoiceUrl(args.apiUrl), {
      method: "POST",
      credentials: "omit",
      headers: {
        "content-type": "application/json",
        ...staffAssistantChatHeaders({
          cookie: args.getCookie(),
          companyId: args.getCompanyId(),
        }),
      },
      body: JSON.stringify({
        conversationId: args.conversationId,
        choiceId: args.choiceId,
        optionId: args.optionId,
      }),
    });
  } catch {
    return { status: "error", recoverability: "retryable" };
  }

  const body = await readJsonBody(response);
  if (!response.ok) {
    if (!body.ok) {
      return malformedSelectResult(
        response.status,
        httpFailureRecoverability(response.status),
      );
    }
    return selectResultFromWireError(response, body.value);
  }
  if (!body.ok) {
    return malformedSelectResult(response.status, "ambiguous");
  }
  const parsed = choiceInteractionResultSchema.safeParse(body.value);
  if (!parsed.success) {
    return malformedSelectResult(response.status, "ambiguous");
  }
  const interaction = parsed.data;
  return withRecoverability({
    status: interaction.status,
    ...(interaction.text === undefined ? {} : { text: interaction.text }),
    ...(interaction.challengeId === undefined
      ? {}
      : { challengeId: interaction.challengeId }),
    ...(interaction.reason === undefined ? {} : { reason: interaction.reason }),
    ...(interaction.choiceKind === undefined
      ? {}
      : { choiceKind: interaction.choiceKind }),
    ...(interaction.productName === undefined
      ? {}
      : { productName: interaction.productName }),
    ...(interaction.options === undefined
      ? {}
      : { options: interaction.options }),
    ...(interaction.optionsTruncated === undefined
      ? {}
      : { optionsTruncated: interaction.optionsTruncated }),
    ...(interaction.entity === undefined ? {} : { entity: interaction.entity }),
    ...(interaction.code === undefined ? {} : { code: interaction.code }),
    ...(interaction.message === undefined
      ? {}
      : { message: interaction.message }),
    httpStatus: response.status,
  });
}

export async function peekAssistantChoice(args: {
  readonly apiUrl: string;
  readonly getCookie: () => string | null;
  readonly getCompanyId: () => string | null;
  readonly conversationId: string;
  readonly choiceId: string;
}): Promise<AssistantChoicePeekResult> {
  let response: Response;
  try {
    response = await expoFetch(
      assistantChoicePeekUrl(args.apiUrl, args.choiceId, args.conversationId),
      {
        method: "GET",
        credentials: "omit",
        headers: staffAssistantChatHeaders({
          cookie: args.getCookie(),
          companyId: args.getCompanyId(),
        }),
      },
    );
  } catch {
    return { kind: "unavailable", recoverability: "retryable" };
  }

  const body = await readJsonBody(response);
  if (!response.ok) {
    const raw = body.ok ? body.value : undefined;
    const code =
      isRecord(raw) && typeof raw.code === "string" ? raw.code : undefined;
    return {
      kind: "unavailable",
      recoverability: httpFailureRecoverability(response.status),
      httpStatus: response.status,
      ...(code === undefined ? {} : { code }),
    };
  }
  if (!body.ok) {
    return { kind: "unavailable", recoverability: "ambiguous" };
  }
  const envelope = envelopeFromChoicePeek(args.choiceId, body.value);
  if (envelope === undefined) {
    return { kind: "unavailable", recoverability: "ambiguous" };
  }
  return { kind: "envelope", envelope };
}
