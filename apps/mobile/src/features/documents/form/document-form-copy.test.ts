import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { documentsCopy } from "../../../i18n/documents";
import {
  fieldErrorsFromFormState,
  mapDocumentFormFailure,
  mapValidationIssues,
  resolveDocumentFormCopy,
  rhfPathsForFieldErrors,
} from "./document-form-copy";
import type { DocumentFormWrite } from "./document-form-plan";
import { emptyFieldErrors } from "./document-form.schema";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const COUNTERPARTY_ID = "22222222-2222-4222-8222-222222222222";

const write: DocumentFormWrite = {
  kind: "createFromOrder",
  input: { orderId: ORDER_ID, type: "payment_invoice" },
};

describe("mapDocumentFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapDocumentFormFailure("network")).toBe("network");
    expect(mapDocumentFormFailure("offline")).toBe("offline");
    expect(mapDocumentFormFailure("permission")).toBe("permission");
    expect(mapDocumentFormFailure("conflict")).toBe("conflict");
    expect(mapDocumentFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapDocumentFormFailure("validation")).toBe("validation");
  });

  it("maps orderId VALIDATION onto the order field and leaves mismatch as banner-only", () => {
    const orderError: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [{ code: "too_small", path: ["orderId"], message: "secret" }],
      },
    });
    expect(mapValidationIssues(orderError, write)).toEqual({
      order: "required",
    });

    const mismatch: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          {
            code: "custom",
            path: ["matches"],
            message: "The counterparty must be linked to the order customer.",
          },
          {
            code: "custom",
            path: ["counterpartyId"],
            message: "secret",
          },
        ],
      },
    });
    expect(
      mapValidationIssues(mismatch, {
        kind: "createFromOrder",
        input: {
          orderId: ORDER_ID,
          type: "payment_invoice",
          counterpartyId: COUNTERPARTY_ID,
        },
      }),
    ).toBeNull();
  });
});

describe("fieldErrorsFromFormState / rhfPathsForFieldErrors", () => {
  it("maps submitted RHF messages onto draft keys", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        orderMessage: "required",
        server: null,
      }),
    ).toEqual({ order: "required" });
    expect(
      fieldErrorsFromFormState({
        submitted: false,
        orderMessage: "required",
        server: emptyFieldErrors(),
      }),
    ).toEqual({ order: null });
    expect(rhfPathsForFieldErrors({ order: "required" })).toEqual([
      { name: "orderId", message: "required" },
    ]);
  });
});

describe("resolveDocumentFormCopy", () => {
  it("hides submit without documents:create", () => {
    const copy = documentsCopy("en").form;
    const denied = resolveDocumentFormCopy(copy, {
      orderError: null,
      banner: null,
      pending: false,
      clientReady: true,
      canCreate: false,
    });
    expect(denied.showSubmit).toBe(false);
    expect(denied.fieldsEditable).toBe(false);
    const allowed = resolveDocumentFormCopy(copy, {
      orderError: "required",
      banner: "conflict",
      pending: false,
      clientReady: true,
      canCreate: true,
    });
    expect(allowed.showSubmit).toBe(true);
    expect(allowed.orderError).toBe(copy.errors.orderRequired);
    expect(allowed.banner).toBe(copy.errors.conflict);
  });
});
