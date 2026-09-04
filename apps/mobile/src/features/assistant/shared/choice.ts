/**
 * Client-side `data-choice` envelope (SHO-418). Duplicates the
 * `@showzy/ai` parser — mobile must not import that package.
 */
import { z } from "zod";

export const STAFF_ASSISTANT_NEEDS_CHOICE_STATUS = "needs_choice" as const;
export const CHOICE_OPTIONS_MAX = 20;

export const CHOICE_TRUNCATED_COPY = {
  en: "More variants exist. Reply with the exact flavour name.",
  uk: "Є ще варіанти. Напишіть точну назву смаку.",
} as const;

export const staffAssistantChoiceCardEnvelopeSchema = z.strictObject({
  status: z.enum(["needs_choice", "claimed", "completed", "expired"]),
  challengeId: z.uuid(),
  reason: z
    .enum([
      "variant_required",
      "ambiguous",
      "unmatched_query",
      "no_active_variants",
    ])
    .optional(),
  productName: z.string().min(1).optional(),
  options: z
    .array(
      z.strictObject({
        id: z.uuid(),
        label: z.string().min(1),
      }),
    )
    .max(CHOICE_OPTIONS_MAX),
  optionsTruncated: z.boolean(),
});

export type StaffAssistantChoiceCardEnvelope = z.output<
  typeof staffAssistantChoiceCardEnvelopeSchema
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function choiceFromChatPart(
  part: unknown,
): StaffAssistantChoiceCardEnvelope | undefined {
  const parsed = staffAssistantChoiceCardEnvelopeSchema.safeParse(part);
  if (parsed.success) {
    return parsed.data;
  }
  if (!isRecord(part)) {
    return undefined;
  }
  const nested = staffAssistantChoiceCardEnvelopeSchema.safeParse(part.data);
  return nested.success ? nested.data : undefined;
}

/**
 * T8a peek returns `{ status: "expired" }` with no other fields. Expand
 * that into a non-tappable expired envelope — never a dead open picker.
 */
export function envelopeFromChoicePeek(
  choiceId: string,
  body: unknown,
): StaffAssistantChoiceCardEnvelope {
  if (isRecord(body) && body.status === "expired") {
    return {
      status: "expired",
      challengeId: choiceId,
      options: [],
      optionsTruncated: false,
    };
  }
  const parsed = staffAssistantChoiceCardEnvelopeSchema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }
  const stripped = choiceEnvelopeForWire(body);
  if (stripped !== undefined) {
    return stripped;
  }
  return {
    status: "expired",
    challengeId: choiceId,
    options: [],
    optionsTruncated: false,
  };
}

/**
 * Keep the ChoiceCard envelope and drop server-only extras
 * (`canonicalInput`, `target`, `optionMap`) if a client echoes them.
 */
export function choiceEnvelopeForWire(
  data: unknown,
): StaffAssistantChoiceCardEnvelope | undefined {
  const direct = choiceFromChatPart(data);
  if (direct !== undefined) {
    return direct;
  }
  if (!isRecord(data)) {
    return undefined;
  }
  const nested = isRecord(data.data) ? data.data : data;
  const stripped = {
    status: nested.status,
    challengeId: nested.challengeId,
    ...(typeof nested.reason === "string" ? { reason: nested.reason } : {}),
    ...(typeof nested.productName === "string"
      ? { productName: nested.productName }
      : {}),
    options: nested.options,
    optionsTruncated: nested.optionsTruncated,
  };
  const parsed = staffAssistantChoiceCardEnvelopeSchema.safeParse(stripped);
  return parsed.success ? parsed.data : undefined;
}

export function presentChoiceCardText(
  envelope: StaffAssistantChoiceCardEnvelope,
  locale: "uk" | "en",
): string {
  const labels = envelope.options.map((option) => option.label).join(", ");
  const name = envelope.productName ?? "";
  const intro =
    locale === "uk"
      ? `Оберіть варіант для ${name}: ${labels}.`
      : `Select a variant for ${name}: ${labels}.`;
  if (envelope.optionsTruncated) {
    return `${intro} ${CHOICE_TRUNCATED_COPY[locale]}`;
  }
  return intro;
}
