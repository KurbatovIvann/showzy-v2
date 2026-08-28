import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  fieldErrorsFromFormState,
  mapCounterpartyFormFailure,
  mapValidationIssues,
  rhfPathsForFieldErrors,
} from "./counterparty-form-copy";
import type { CounterpartyFormWrite } from "./counterparty-form-plan";
import { emptyFieldErrors } from "./counterparty-form.schema";

describe("mapCounterpartyFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapCounterpartyFormFailure("network")).toBe("network");
    expect(mapCounterpartyFormFailure("offline")).toBe("offline");
    expect(mapCounterpartyFormFailure("permission")).toBe("permission");
    expect(mapCounterpartyFormFailure("conflict")).toBe("conflict");
    expect(mapCounterpartyFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapCounterpartyFormFailure("validation")).toBe("validation");
  });

  it("maps VALIDATION issues onto fields by path", () => {
    const write: CounterpartyFormWrite = {
      kind: "createCounterparty",
      input: { name: "ФОП Іваненко" },
    };
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_small", path: ["name"], message: "secret" },
          { code: "too_big", path: ["edrpou"], message: "secret" },
          { code: "too_big", path: ["iban"], message: "secret" },
        ],
      },
    });
    expect(mapValidationIssues(error, write)).toEqual({
      name: "required",
      edrpou: "too_long",
      legalAddress: null,
      iban: "too_long",
      bankName: null,
      bankMfo: null,
      phone: null,
      email: null,
      notes: null,
    });
  });

  it("leaves customerId VALIDATION as banner-only", () => {
    const write: CounterpartyFormWrite = {
      kind: "createCounterparty",
      input: { name: "ФОП Іваненко" },
    };
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [{ code: "custom", path: ["customerId"], message: "secret" }],
      },
    });
    expect(mapValidationIssues(error, write)).toBeNull();
  });
});

describe("fieldErrorsFromFormState", () => {
  it("maps submitted RHF messages onto draft keys", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        nameMessage: "required",
        edrpouMessage: "too_long",
        legalAddressMessage: undefined,
        ibanMessage: undefined,
        bankNameMessage: undefined,
        bankMfoMessage: undefined,
        phoneMessage: undefined,
        emailMessage: undefined,
        notesMessage: undefined,
        server: null,
      }),
    ).toEqual({
      name: "required",
      edrpou: "too_long",
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      phone: null,
      email: null,
      notes: null,
    });
  });
});

describe("rhfPathsForFieldErrors", () => {
  it("puts name required on the name field", () => {
    expect(
      rhfPathsForFieldErrors({
        ...emptyFieldErrors(),
        name: "required",
      }),
    ).toEqual([{ name: "name", message: "required" }]);
  });
});
