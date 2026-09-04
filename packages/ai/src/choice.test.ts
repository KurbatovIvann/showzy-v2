import { CONFIRMATION_TTL_MS } from "@showzy/core";
import { ConflictError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  applyChoiceOptionToCanonicalInput,
  assistantChoiceBodySchema,
  bindChoiceOptions,
  catalogPickerConflictExtrasFromError,
  CHOICE_OPTIONS_MAX,
  CHOICE_TTL_MS,
  choiceCardEnvelope,
  choiceRedisKey,
  needsChoiceFromOrdersCreateConflict,
  parseChoiceRecord,
  peekEnvelopeFromRecord,
  serializeChoiceRecord,
  staffAssistantChoiceCardEnvelopeSchema,
  successorChoiceId,
  type ChoiceCanonicalCreateInput,
  type ChoiceRecord,
} from "./choice.js";

const conversationId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const choiceId = "33333333-3333-4333-8333-333333333333";
const productId = "44444444-4444-4444-8444-444444444444";
const variantLemon = "55555555-5555-4555-8555-555555555555";
const variantVanilla = "66666666-6666-4666-8666-666666666666";
const customerId = "77777777-7777-4777-8777-777777777777";
const optionLemon = "88888888-8888-4888-8888-888888888888";
const optionVanilla = "99999999-9999-4999-8999-999999999999";

const canonical: ChoiceCanonicalCreateInput = {
  customer: { by: "id", id: customerId },
  items: [
    {
      product: { by: "id", id: productId },
      variantSelection: { kind: "unspecified" },
      quantity: { milli: "1000" },
    },
  ],
};

function sampleRecord(status: ChoiceRecord["status"] = "open"): ChoiceRecord {
  return {
    status,
    choiceId,
    actorId: "anna",
    companyId,
    conversationId,
    canonicalInput: canonical,
    target: {
      lineIndex: 0,
      productId,
      productName: "Macarons",
    },
    optionMap: {
      [optionLemon]: variantLemon,
      [optionVanilla]: variantVanilla,
    },
    envelope: {
      status: "needs_choice",
      challengeId: choiceId,
      reason: "variant_required",
      productName: "Macarons",
      options: [
        { id: optionLemon, label: "Lemon" },
        { id: optionVanilla, label: "Vanilla" },
      ],
      optionsTruncated: false,
    },
  };
}

describe("choice transport (SHO-409)", () => {
  it("uses a 15-minute TTL longer than confirmation's 5 minutes", () => {
    expect(CHOICE_TTL_MS).toBe(15 * 60 * 1000);
    expect(CHOICE_TTL_MS).toBeGreaterThan(CONFIRMATION_TTL_MS);
    expect(CONFIRMATION_TTL_MS).toBe(5 * 60 * 1000);
    expect(CHOICE_OPTIONS_MAX).toBe(20);
  });

  it("names Redis keys choice:{choiceId}", () => {
    expect(choiceRedisKey(choiceId)).toBe(`choice:${choiceId}`);
  });

  it("rejects extra client fields on the resume body", () => {
    const parsed = assistantChoiceBodySchema.safeParse({
      conversationId,
      choiceId,
      optionId: optionLemon,
      target: { lineIndex: 9, productId, productName: "tamper" },
      variantId: variantLemon,
      slot: "line-0",
    });
    expect(parsed.success).toBe(false);
    expect(
      assistantChoiceBodySchema.parse({
        conversationId,
        choiceId,
        optionId: optionLemon,
      }),
    ).toEqual({
      conversationId,
      choiceId,
      optionId: optionLemon,
    });
  });

  it("mints opaque option ids and keeps variant ids only in the map", () => {
    const bound = bindChoiceOptions(
      [
        { id: variantLemon, label: "Lemon" },
        { id: variantVanilla, label: "Vanilla" },
      ],
      false,
      (() => {
        let n = 0;
        return () => {
          n += 1;
          return n === 1 ? optionLemon : optionVanilla;
        };
      })(),
    );
    expect(bound.options.map((option) => option.id)).toEqual([
      optionLemon,
      optionVanilla,
    ]);
    expect(bound.optionMap[optionLemon]).toBe(variantLemon);
    expect(JSON.stringify(bound.options)).not.toContain(variantLemon);
  });

  it("patches the server target line and ignores a leftover variant field", () => {
    const withLegacyVariant: ChoiceCanonicalCreateInput = {
      customer: canonical.customer,
      items: [
        {
          product: { by: "id", id: productId },
          variant: { by: "query", value: "client-slot" },
          variantSelection: { kind: "unspecified" },
          quantity: { milli: "1000" },
        },
        {
          product: { by: "query", value: "Other" },
          variantSelection: { kind: "unspecified" },
          quantity: { decimal: "2" },
        },
      ],
    };
    const patched = applyChoiceOptionToCanonicalInput(
      withLegacyVariant,
      0,
      variantLemon,
    );
    expect(patched.items[0]).toEqual({
      product: { by: "id", id: productId },
      quantity: { milli: "1000" },
      variantSelection: {
        kind: "reference",
        ref: { by: "id", id: variantLemon },
      },
    });
    expect(patched.items[0]).not.toHaveProperty("variant");
    expect(patched.items[1]).toEqual(withLegacyVariant.items[1]);
  });

  it("peek envelope omits canonical input, target, mapping, actor, and company", () => {
    const envelope = peekEnvelopeFromRecord(sampleRecord("open"));
    expect(envelope).toEqual({
      status: "needs_choice",
      challengeId: choiceId,
      reason: "variant_required",
      productName: "Macarons",
      options: [
        { id: optionLemon, label: "Lemon" },
        { id: optionVanilla, label: "Vanilla" },
      ],
      optionsTruncated: false,
    });
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain("canonicalInput");
    expect(serialized).not.toContain("lineIndex");
    expect(serialized).not.toContain(productId);
    expect(serialized).not.toContain(variantLemon);
    expect(serialized).not.toContain("optionMap");
    expect(serialized).not.toContain("actorId");
    expect(serialized).not.toContain(companyId);
    expect(
      staffAssistantChoiceCardEnvelopeSchema.safeParse({
        ...envelope,
        target: { lineIndex: 0, productId, productName: "Macarons" },
      }).success,
    ).toBe(false);
  });

  it("round-trips a stored record and derives a stable successor id", () => {
    const raw = serializeChoiceRecord(sampleRecord("claimed"));
    expect(parseChoiceRecord(raw)?.choiceId).toBe(choiceId);
    expect(successorChoiceId(choiceId)).toBe(successorChoiceId(choiceId));
    expect(successorChoiceId(choiceId)).not.toBe(choiceId);
    expect(
      choiceCardEnvelope({
        challengeId: choiceId,
        status: "expired",
        options: [],
        optionsTruncated: false,
      }).status,
    ).toBe("expired");
  });
});

class DuckTypedPickerConflict extends ConflictError {
  readonly reason: string;
  readonly target: {
    readonly kind: "order_line_variant";
    readonly lineIndex: number;
    readonly productId: string;
    readonly productName: string;
  };
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly optionsTruncated: boolean;

  constructor(args: {
    readonly reason: string;
    readonly options: readonly { readonly id: string; readonly label: string }[];
    readonly optionsTruncated?: boolean;
  }) {
    super('Select a variant for "Macarons".');
    this.reason = args.reason;
    this.target = {
      kind: "order_line_variant",
      lineIndex: 0,
      productId,
      productName: "Macarons",
    };
    this.options = args.options;
    this.optionsTruncated = args.optionsTruncated ?? false;
  }
}

describe("duck-typed catalog CONFLICT extras (SHO-418)", () => {
  it("does not import catalog", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "choice.ts"),
      "utf8",
    );
    expect(source).not.toContain("@showzy/catalog");
  });

  it("parses picker extras and ignores no_active_variants", () => {
    const picker = new DuckTypedPickerConflict({
      reason: "variant_required",
      options: [
        { id: variantLemon, label: "Lemon" },
        { id: variantVanilla, label: "Vanilla" },
      ],
    });
    expect(catalogPickerConflictExtrasFromError(picker)?.reason).toBe(
      "variant_required",
    );
    expect(
      catalogPickerConflictExtrasFromError(
        new DuckTypedPickerConflict({
          reason: "no_active_variants",
          options: [],
        }),
      ),
    ).toBeUndefined();
    expect(
      catalogPickerConflictExtrasFromError(
        new ConflictError("plain conflict"),
      ),
    ).toBeUndefined();
  });

  it("opens needs_choice from orders.create CONFLICT and skips empty options", async () => {
    const opened: ChoiceRecord[] = [];
    const output = await needsChoiceFromOrdersCreateConflict({
      actionName: "orders.create",
      input: canonical,
      error: new DuckTypedPickerConflict({
        reason: "ambiguous",
        options: [{ id: variantLemon, label: "Lemon" }],
      }),
      bind: {
        actorId: "anna",
        companyId,
        conversationId,
      },
      openChoice: (record) => {
        opened.push(record);
        return Promise.resolve(true);
      },
      mintChoiceId: () => choiceId,
    });
    expect(output?.status).toBe("needs_choice");
    expect(output?.options).toHaveLength(1);
    expect(opened).toHaveLength(1);
    expect(JSON.stringify(output)).not.toContain("canonicalInput");
    expect(JSON.stringify(output)).not.toContain(productId);

    const empty = await needsChoiceFromOrdersCreateConflict({
      actionName: "orders.create",
      input: canonical,
      error: new DuckTypedPickerConflict({
        reason: "no_active_variants",
        options: [],
      }),
      bind: {
        actorId: "anna",
        companyId,
        conversationId,
      },
      openChoice: () => Promise.resolve(true),
    });
    expect(empty).toBeUndefined();
  });
});
