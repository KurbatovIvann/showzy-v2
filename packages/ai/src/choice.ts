/**
 * Staff-assistant choice transport (SHO-409 / SHO-401 T8a).
 *
 * Canonical create input, server-only line target, and optionId → variantId
 * mapping stay on the server. The client sends `{ choiceId, optionId }` and
 * may read only the ChoiceCard envelope. Nothing here produces
 * `needs_choice` from a user chat turn (SHO-418).
 *
 * TTL is 15 minutes — deliberately longer than core `CONFIRMATION_TTL_MS`
 * (5 minutes). "Are you sure" and "which one" tolerate interruption
 * differently; keep the asymmetry.
 */
import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

export const STAFF_ASSISTANT_NEEDS_CHOICE_STATUS = "needs_choice" as const;

/**
 * 15 minutes. Core confirmation is 5 minutes (`CONFIRMATION_TTL_MS`).
 * Do not import core to keep this package independent of that constant.
 */
export const CHOICE_TTL_MS = 15 * 60 * 1000;

/**
 * Variant picker cap. Not `REFERENCE_CONFLICT_LABELS_MAX` (5), which would
 * clip a normal 6-flavour product. Matches catalog
 * `VARIANT_SELECTION_OPTIONS_MAX`.
 */
export const CHOICE_OPTIONS_MAX = 20;

export const CHOICE_REDIS_KEY_PREFIX = "choice:" as const;

export function choiceRedisKey(choiceId: string): string {
  return `${CHOICE_REDIS_KEY_PREFIX}${choiceId}`;
}

export const CHOICE_RESOLUTION_REASONS = [
  "variant_required",
  "ambiguous",
  "unmatched_query",
  "no_active_variants",
] as const;

export type ChoiceResolutionReason = (typeof CHOICE_RESOLUTION_REASONS)[number];

export const choiceResolutionReasonSchema = z.enum(CHOICE_RESOLUTION_REASONS);

const entityRefSchema = z.discriminatedUnion("by", [
  z.strictObject({ by: z.literal("id"), id: z.uuid() }),
  z.strictObject({ by: z.literal("query"), value: z.string().min(1) }),
]);

const variantSelectionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("unspecified") }),
  z.strictObject({ kind: z.literal("base") }),
  z.strictObject({
    kind: z.literal("reference"),
    ref: entityRefSchema,
  }),
]);

const quantitySchema = z.union([
  z.strictObject({ milli: z.string().min(1) }),
  z.strictObject({ decimal: z.string().min(1) }),
]);

const choiceCanonicalItemSchema = z.strictObject({
  product: entityRefSchema,
  variant: entityRefSchema.optional(),
  variantSelection: variantSelectionSchema.optional(),
  quantity: quantitySchema,
});

/**
 * Server-side `orders.create` input stored with the draft. Duplicated so
 * `@showzy/ai` does not import the orders module.
 */
export const choiceCanonicalCreateInputSchema = z.strictObject({
  customer: entityRefSchema,
  items: z.array(choiceCanonicalItemSchema).min(1),
  comment: z.string().optional(),
});

export type ChoiceCanonicalCreateInput = z.output<
  typeof choiceCanonicalCreateInputSchema
>;

export const choiceTargetSchema = z.strictObject({
  lineIndex: z.number().int().nonnegative(),
  productId: z.uuid(),
  productName: z.string().min(1),
});

export type ChoiceTarget = z.output<typeof choiceTargetSchema>;

export const choiceCardOptionSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().min(1),
});

export type ChoiceCardOption = z.output<typeof choiceCardOptionSchema>;

export const choiceCardStateSchema = z.enum([
  "needs_choice",
  "claimed",
  "completed",
  "expired",
]);

export type ChoiceCardState = z.output<typeof choiceCardStateSchema>;

/**
 * Client ChoiceCard envelope. Never includes canonical input, target,
 * option mapping, actor, or company.
 */
export const staffAssistantChoiceCardEnvelopeSchema = z.strictObject({
  status: choiceCardStateSchema,
  challengeId: z.uuid(),
  reason: choiceResolutionReasonSchema.optional(),
  productName: z.string().min(1).optional(),
  options: z.array(choiceCardOptionSchema).max(CHOICE_OPTIONS_MAX),
  optionsTruncated: z.boolean(),
});

export type StaffAssistantChoiceCardEnvelope = z.output<
  typeof staffAssistantChoiceCardEnvelopeSchema
>;

export const staffAssistantNeedsChoiceOutputSchema = z.strictObject({
  status: z.literal(STAFF_ASSISTANT_NEEDS_CHOICE_STATUS),
  challengeId: z.uuid(),
  reason: choiceResolutionReasonSchema,
  productName: z.string().min(1),
  options: z.array(choiceCardOptionSchema).max(CHOICE_OPTIONS_MAX),
  optionsTruncated: z.boolean(),
});

export type StaffAssistantNeedsChoiceOutput = z.output<
  typeof staffAssistantNeedsChoiceOutputSchema
>;

export const choiceBindSchema = z.strictObject({
  actorId: z.string().min(1),
  companyId: z.uuid(),
  conversationId: z.uuid(),
});

export type ChoiceBind = z.output<typeof choiceBindSchema>;

export const choiceRecordStatusSchema = z.enum([
  "open",
  "claimed",
  "completed",
]);

export type ChoiceRecordStatus = z.output<typeof choiceRecordStatusSchema>;

const optionMapSchema = z.record(z.uuid(), z.uuid());

export const choiceRecordSchema = z.strictObject({
  status: choiceRecordStatusSchema,
  choiceId: z.uuid(),
  actorId: z.string().min(1),
  companyId: z.uuid(),
  conversationId: z.uuid(),
  canonicalInput: choiceCanonicalCreateInputSchema,
  target: choiceTargetSchema,
  optionMap: optionMapSchema,
  envelope: staffAssistantChoiceCardEnvelopeSchema,
  locale: z.enum(["uk", "en"]).optional(),
  claimedOptionId: z.uuid().optional(),
});

export type ChoiceRecord = z.output<typeof choiceRecordSchema>;

export const assistantChoiceBodySchema = z.strictObject({
  conversationId: z.uuid(),
  choiceId: z.uuid(),
  optionId: z.uuid(),
});

export type AssistantChoiceBody = z.output<typeof assistantChoiceBodySchema>;

export const assistantChoiceCompletedEntitySchema = z.strictObject({
  orderId: z.uuid(),
  orderNumber: z.string().min(1),
});

export const assistantChoiceInteractionResultSchema = z.discriminatedUnion(
  "status",
  [
    z.strictObject({
      status: z.literal("completed"),
      text: z.string().min(1),
      entity: assistantChoiceCompletedEntitySchema,
    }),
    staffAssistantNeedsChoiceOutputSchema,
    z.strictObject({
      status: z.literal("expired"),
    }),
    z.strictObject({
      status: z.literal("error"),
      code: z.string().min(1),
      message: z.string().min(1),
    }),
  ],
);

export type AssistantChoiceInteractionResult = z.output<
  typeof assistantChoiceInteractionResultSchema
>;

export type CatalogChoiceOption = {
  readonly id: string;
  readonly label: string;
};

export type BoundChoiceOptions = {
  readonly options: readonly ChoiceCardOption[];
  readonly optionMap: Readonly<Record<string, string>>;
  readonly optionsTruncated: boolean;
};

/**
 * Mint opaque optionIds. Catalog picker ids are variant UUIDs — those stay
 * in `optionMap` and never go to the client as option ids.
 */
export function bindChoiceOptions(
  catalogOptions: readonly CatalogChoiceOption[],
  optionsTruncated: boolean,
  randomId: () => string = randomUUID,
): BoundChoiceOptions {
  const capped = catalogOptions.slice(0, CHOICE_OPTIONS_MAX);
  const truncated =
    optionsTruncated || catalogOptions.length > CHOICE_OPTIONS_MAX;
  const optionMap: Record<string, string> = {};
  const options: ChoiceCardOption[] = [];
  for (const option of capped) {
    const optionId = randomId();
    optionMap[optionId] = option.id;
    options.push({ id: optionId, label: option.label });
  }
  return { options, optionMap, optionsTruncated: truncated };
}

export function choiceCardEnvelope(input: {
  readonly challengeId: string;
  readonly status: ChoiceCardState;
  readonly reason?: ChoiceResolutionReason;
  readonly productName?: string;
  readonly options: readonly ChoiceCardOption[];
  readonly optionsTruncated: boolean;
}): StaffAssistantChoiceCardEnvelope {
  return staffAssistantChoiceCardEnvelopeSchema.parse({
    status: input.status,
    challengeId: input.challengeId,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.productName !== undefined
      ? { productName: input.productName }
      : {}),
    options: [...input.options],
    optionsTruncated: input.optionsTruncated,
  });
}

export function needsChoiceOutputFromRecord(
  record: ChoiceRecord,
): StaffAssistantNeedsChoiceOutput {
  return staffAssistantNeedsChoiceOutputSchema.parse({
    status: STAFF_ASSISTANT_NEEDS_CHOICE_STATUS,
    challengeId: record.choiceId,
    reason: record.envelope.reason ?? "variant_required",
    productName: record.envelope.productName ?? record.target.productName,
    options: record.envelope.options,
    optionsTruncated: record.envelope.optionsTruncated,
  });
}

export function peekEnvelopeFromRecord(
  record: ChoiceRecord,
): StaffAssistantChoiceCardEnvelope {
  const status: ChoiceCardState =
    record.status === "open"
      ? "needs_choice"
      : record.status === "claimed"
        ? "claimed"
        : "completed";
  return choiceCardEnvelope({
    challengeId: record.choiceId,
    status,
    ...(record.envelope.reason !== undefined
      ? { reason: record.envelope.reason }
      : {}),
    ...(record.envelope.productName !== undefined
      ? { productName: record.envelope.productName }
      : {}),
    options: record.envelope.options,
    optionsTruncated: record.envelope.optionsTruncated,
  });
}

export function bindsMatch(left: ChoiceBind, right: ChoiceBind): boolean {
  return (
    left.actorId === right.actorId &&
    left.companyId === right.companyId &&
    left.conversationId === right.conversationId
  );
}

export function recordBind(record: ChoiceRecord): ChoiceBind {
  return {
    actorId: record.actorId,
    companyId: record.companyId,
    conversationId: record.conversationId,
  };
}

/**
 * Patch the server-stored target line with the mapped variant id.
 * Client-supplied target / slot / variant id is never an argument.
 */
export function applyChoiceOptionToCanonicalInput(
  input: ChoiceCanonicalCreateInput,
  lineIndex: number,
  variantId: string,
): ChoiceCanonicalCreateInput {
  const items = input.items.map((item, index) => {
    if (index !== lineIndex) {
      return item;
    }
    return {
      product: item.product,
      quantity: item.quantity,
      variantSelection: {
        kind: "reference" as const,
        ref: { by: "id" as const, id: variantId },
      },
    };
  });
  return {
    customer: input.customer,
    items,
    ...(input.comment !== undefined ? { comment: input.comment } : {}),
  };
}

export function resolveMappedVariantId(
  optionMap: Readonly<Record<string, string>>,
  optionId: string,
): string | undefined {
  return optionMap[optionId];
}

/**
 * Deterministic successor id so a retry of a sequential `needs_choice`
 * reuses the same Redis key (SET NX) instead of minting a second draft.
 */
export function successorChoiceId(parentChoiceId: string): string {
  const bytes = createHash("sha256")
    .update(`choice:successor:${parentChoiceId}`)
    .digest()
    .subarray(0, 16);
  const copy = Uint8Array.from(bytes);
  copy[6] = ((copy[6] ?? 0) & 0x0f) | 0x40;
  copy[8] = ((copy[8] ?? 0) & 0x3f) | 0x80;
  const hex = Buffer.from(copy).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function parseChoiceRecord(raw: string): ChoiceRecord | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  const result = choiceRecordSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

export function serializeChoiceRecord(record: ChoiceRecord): string {
  return JSON.stringify(choiceRecordSchema.parse(record));
}
