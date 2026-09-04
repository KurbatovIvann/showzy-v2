import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { assistantCopy } from "../../../i18n/assistant";
import {
  CHOICE_TRUNCATED_COPY,
  choiceEnvelopeForWire,
  envelopeFromChoicePeek,
  presentChoiceCardText,
} from "./choice";

const choiceId = "33333333-3333-4333-8333-333333333333";
const lemonId = "88888888-8888-4888-8888-888888888888";

const openEnvelope = {
  status: "needs_choice" as const,
  challengeId: choiceId,
  reason: "variant_required" as const,
  productName: "Macarons",
  options: [{ id: lemonId, label: "Lemon" }],
  optionsTruncated: false,
};

describe("envelopeFromChoicePeek", () => {
  it("expands T8a { status: expired } into a non-tappable expired envelope", () => {
    expect(envelopeFromChoicePeek(choiceId, { status: "expired" })).toEqual({
      status: "expired",
      challengeId: choiceId,
      options: [],
      optionsTruncated: false,
    });
  });

  it("keeps a live peek envelope", () => {
    expect(envelopeFromChoicePeek(choiceId, openEnvelope)).toEqual(
      openEnvelope,
    );
  });

  it("treats an unreadable peek as expired", () => {
    expect(envelopeFromChoicePeek(choiceId, "nope")).toMatchObject({
      status: "expired",
      challengeId: choiceId,
    });
  });
});

describe("choiceEnvelopeForWire", () => {
  it("keeps a valid envelope and drops canonicalInput, target, and optionMap", () => {
    expect(
      choiceEnvelopeForWire({
        ...openEnvelope,
        canonicalInput: { customer: { by: "id", id: choiceId } },
        target: { lineIndex: 0, productId: choiceId, productName: "Macarons" },
        optionMap: { [lemonId]: choiceId },
      }),
    ).toEqual(openEnvelope);
  });
});

describe("choice truncated copy", () => {
  it("matches presenter copy and ChoiceCard i18n", () => {
    expect(CHOICE_TRUNCATED_COPY.en).toBe(
      "More variants exist. Reply with the exact flavour name.",
    );
    expect(CHOICE_TRUNCATED_COPY.uk).toBe(
      "Є ще варіанти. Напишіть точну назву смаку.",
    );
    const en = assistantCopy("en");
    const uk = assistantCopy("uk");
    expect(en.choiceTruncated).toBe(CHOICE_TRUNCATED_COPY.en);
    expect(uk.choiceTruncated).toBe(CHOICE_TRUNCATED_COPY.uk);
    expect(
      presentChoiceCardText(
        { ...openEnvelope, optionsTruncated: true },
        "en",
      ),
    ).toContain(CHOICE_TRUNCATED_COPY.en);
  });

  it("does not import @showzy/ai from ChoiceCard", () => {
    const card = readFileSync(
      new URL("../sheet/choice-card.tsx", import.meta.url),
      "utf8",
    );
    expect(card).toContain("ChoiceCard");
    expect(card).not.toContain("@showzy/ai");
    expect(card).toContain("Button");
    expect(card).toContain("Card");
  });
});
