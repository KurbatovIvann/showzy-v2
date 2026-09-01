import { describe, expect, it } from "vitest";

import { onboardingCopy } from "../../../i18n/companies/onboarding";
import {
  COMPANY_LEGAL_NAME_MAX,
  emptyLegalDraft,
  parseUpdateLegalInput,
  planOnboardingLegalSubmit,
  updateLegalPayload,
  validateOnboardingLegal,
} from "./legal-form";

describe("updateLegalPayload", () => {
  it("never includes companyId and stores empty optionals as null", () => {
    const payload = updateLegalPayload({
      ...emptyLegalDraft(),
      companyType: "tov",
      legalName: "  ТОВ Квіти  ",
      edrpou: "  ",
    });
    expect(payload.companyType).toBe("tov");
    expect(payload.legalName).toBe("ТОВ Квіти");
    expect(payload.edrpou).toBeNull();
    expect(payload.bankEdrpou).toBeNull();
    expect(payload.phone).toBeNull();
    expect(payload.email).toBeNull();
    expect("companyId" in payload).toBe(false);
    expect(parseUpdateLegalInput(payload).legalName).toBe("ТОВ Квіти");
  });
});

describe("validateOnboardingLegal", () => {
  it("requires a legal name and caps contract lengths", () => {
    expect(validateOnboardingLegal(emptyLegalDraft()).legalName).toBe(
      "required",
    );
    expect(
      validateOnboardingLegal({
        ...emptyLegalDraft(),
        legalName: "x".repeat(COMPANY_LEGAL_NAME_MAX + 1),
      }).legalName,
    ).toBe("too_long");
    expect(
      validateOnboardingLegal({
        ...emptyLegalDraft(),
        legalName: "ФОП Іваненко",
        edrpou: "1".repeat(11),
      }).edrpou,
    ).toBe("too_long");
  });
});

describe("planOnboardingLegalSubmit", () => {
  it("retries the same payload after a network failure", () => {
    const draft = { ...emptyLegalDraft(), legalName: "ФОП Іваненко" };
    const first = planOnboardingLegalSubmit({
      draft,
      lastSubmitted: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("submit");
    if (first.kind !== "submit") {
      return;
    }
    expect(
      planOnboardingLegalSubmit({
        draft,
        lastSubmitted: first.input,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
    expect(onboardingCopy("uk").legalSkip.length).toBeGreaterThan(0);
  });
});
