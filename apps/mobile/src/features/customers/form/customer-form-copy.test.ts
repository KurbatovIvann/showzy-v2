import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  fieldErrorsFromFormState,
  mapCustomerFormFailure,
  mapValidationIssues,
  rhfPathsForFieldErrors,
} from "./customer-form-copy";
import type { CustomerFormWrite } from "./customer-form-plan";
import { emptyFieldErrors } from "./customer-form.schema";

describe("mapCustomerFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapCustomerFormFailure("network")).toBe("network");
    expect(mapCustomerFormFailure("offline")).toBe("offline");
    expect(mapCustomerFormFailure("permission")).toBe("permission");
    expect(mapCustomerFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapCustomerFormFailure("validation")).toBe("validation");
  });

  it("maps VALIDATION issues onto fields by path", () => {
    const write: CustomerFormWrite = {
      kind: "createCustomer",
      input: { name: "Марія", phone: "+38067" },
    };
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_small", path: ["name"], message: "secret" },
          { code: "too_big", path: ["phone"], message: "secret" },
        ],
      },
    });
    expect(mapValidationIssues(error, write)).toEqual({
      name: "required",
      phone: "too_long",
      email: null,
      notes: null,
      contact: null,
    });
  });
});

describe("fieldErrorsFromFormState", () => {
  it("maps RHF contact refine onto the contact field, not phone too_long", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        nameMessage: "required",
        phoneMessage: "contact",
        emailMessage: undefined,
        notesMessage: undefined,
        server: null,
      }),
    ).toEqual({
      name: "required",
      phone: null,
      email: null,
      notes: null,
      contact: "required",
    });
  });
});

describe("rhfPathsForFieldErrors", () => {
  it("puts contact refine on phone with message contact", () => {
    expect(
      rhfPathsForFieldErrors({
        ...emptyFieldErrors(),
        contact: "required",
      }),
    ).toEqual([{ name: "phone", message: "contact" }]);
  });
});
