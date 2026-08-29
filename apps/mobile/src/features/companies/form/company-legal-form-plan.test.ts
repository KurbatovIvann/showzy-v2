import { describe, expect, it } from "vitest";

import {
  emptyCompanyLegalFormDraft,
  snapshotFromDraft,
  type CompanyLegalFormDraft,
} from "./company-legal-form-draft";
import {
  parseThenPlanCompanyLegalFormSave,
  planCompanyLegalFormSave,
  updateLegalPayload,
} from "./company-legal-form-plan";

const SAMPLE_UA_IBAN = "UA000000000000000000000000000";

function validAddDraft(): CompanyLegalFormDraft {
  return {
    ...emptyCompanyLegalFormDraft(),
    legalName: "  ФОП Іваненко  ",
  };
}

describe("updateLegalPayload", () => {
  it("sends trimmed legal name and null optionals", () => {
    expect(updateLegalPayload(validAddDraft())).toEqual({
      companyType: "fop",
      legalName: "ФОП Іваненко",
      edrpou: null,
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      bankEdrpou: null,
      phone: null,
      email: null,
    });
  });

  it("round-trips ФОП/ТОВ and includes filled requisites", () => {
    expect(
      updateLegalPayload({
        ...validAddDraft(),
        companyType: "tov",
        legalName: "ТОВ Софі",
        edrpou: "3312456789",
        iban: `  ${SAMPLE_UA_IBAN}  `,
        bankEdrpou: "12345678",
      }),
    ).toMatchObject({
      companyType: "tov",
      legalName: "ТОВ Софі",
      edrpou: "3312456789",
      iban: SAMPLE_UA_IBAN,
      bankEdrpou: "12345678",
    });
    expect(
      updateLegalPayload({
        ...validAddDraft(),
        companyType: "fop",
      })?.companyType,
    ).toBe("fop");
  });
});

describe("planCompanyLegalFormSave", () => {
  it("writes on first add and retries the same attempt after a network failure", () => {
    const first = planCompanyLegalFormSave({
      mode: "add",
      draft: validAddDraft(),
      baseline: null,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(first.kind).toBe("write");
    if (first.kind !== "write") {
      return;
    }
    expect(first.write.kind).toBe("updateLegal");
    expect(first.write.input.companyType).toBe("fop");
    expect(
      planCompanyLegalFormSave({
        mode: "add",
        draft: validAddDraft(),
        baseline: null,
        lastWrite: first.write,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("stays invalid without calling transport", () => {
    expect(
      planCompanyLegalFormSave({
        mode: "add",
        draft: emptyCompanyLegalFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });

  it("plans a dirty edit, noops when unchanged, and writes a ФОП→ТОВ change", () => {
    const draft = {
      ...validAddDraft(),
      legalName: "ФОП Іваненко",
    };
    const baseline = snapshotFromDraft(draft);
    expect(baseline).not.toBeNull();
    if (baseline === null) {
      return;
    }
    expect(
      planCompanyLegalFormSave({
        mode: "edit",
        draft,
        baseline,
        lastWrite: null,
        lastFailureKind: null,
      }),
    ).toEqual({ kind: "noop" });

    const switched: CompanyLegalFormDraft = { ...draft, companyType: "tov" };
    const planned = planCompanyLegalFormSave({
      mode: "edit",
      draft: switched,
      baseline,
      lastWrite: null,
      lastFailureKind: null,
    });
    expect(planned.kind).toBe("write");
    if (planned.kind !== "write") {
      return;
    }
    expect(planned.write.input.companyType).toBe("tov");
    expect(planned.write.input.legalName).toBe("ФОП Іваненко");
  });
});

describe("parseThenPlanCompanyLegalFormSave", () => {
  it("gates the planner behind a successful UI parse", () => {
    expect(
      parseThenPlanCompanyLegalFormSave({
        mode: "add",
        draft: emptyCompanyLegalFormDraft(),
        baseline: null,
        lastWrite: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
  });
});
