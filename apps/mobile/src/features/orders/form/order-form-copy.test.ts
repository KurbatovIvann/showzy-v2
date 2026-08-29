import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { ordersCopy } from "../../../i18n/orders";
import {
  fieldErrorsFromFormState,
  mapOrderFormFailure,
  mapValidationIssues,
  resolveOrderFormCopy,
  rhfItemsMessage,
  rhfPathsForFieldErrors,
} from "./order-form-copy";
import type { OrderFormWrite } from "./order-form-plan";
import { emptyFieldErrors } from "./order-form.schema";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

describe("mapOrderFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapOrderFormFailure("network")).toBe("network");
    expect(mapOrderFormFailure("offline")).toBe("offline");
    expect(mapOrderFormFailure("permission")).toBe("permission");
    expect(mapOrderFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapOrderFormFailure("validation")).toBe("validation");
  });

  it("maps VALIDATION issues onto fields by path", () => {
    const write: OrderFormWrite = {
      kind: "createOrder",
      input: {
        customerId: CUSTOMER_ID,
        items: [{ productId: PRODUCT_ID, quantityMilli: "1000" }],
      },
    };
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_small", path: ["customerId"], message: "secret" },
          { code: "too_small", path: ["items"], message: "secret" },
          { code: "too_big", path: ["comment"], message: "secret" },
        ],
      },
    });
    expect(mapValidationIssues(error, write)).toEqual({
      customer: "required",
      items: "required",
      comment: "too_long",
    });
  });
});

describe("fieldErrorsFromFormState / rhfPathsForFieldErrors", () => {
  it("maps submitted RHF messages onto draft keys", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        customerMessage: "required",
        itemsMessage: "duplicate",
        commentMessage: "too_long",
        server: null,
      }),
    ).toEqual({
      customer: "required",
      items: "duplicate",
      comment: "too_long",
    });
    expect(
      rhfPathsForFieldErrors({
        customer: "required",
        items: "duplicate",
        comment: "too_long",
      }),
    ).toEqual([
      { name: "customerId", message: "required" },
      { name: "items", message: "duplicate" },
      { name: "comment", message: "too_long" },
    ]);
    expect(rhfItemsMessage({ message: "required" })).toBe("required");
    expect(rhfItemsMessage({ root: { message: "duplicate" } })).toBe(
      "duplicate",
    );
    expect(emptyFieldErrors()).toEqual({
      customer: null,
      items: null,
      comment: null,
    });
  });
});

describe("resolveOrderFormCopy", () => {
  it("hides submit without orders:create and disables it while pending", () => {
    const copy = ordersCopy("uk").create;
    const denied = resolveOrderFormCopy(copy, {
      customerError: null,
      itemsError: null,
      commentError: null,
      banner: null,
      pending: false,
      clientReady: true,
      canCreate: false,
    });
    expect(denied.showSubmit).toBe(false);
    expect(denied.submitDisabled).toBe(true);
    expect(denied.fieldsEditable).toBe(false);
    const pending = resolveOrderFormCopy(copy, {
      customerError: "required",
      itemsError: "required",
      commentError: null,
      banner: null,
      pending: true,
      clientReady: true,
      canCreate: true,
    });
    expect(pending.showSubmit).toBe(true);
    expect(pending.submitDisabled).toBe(true);
    expect(pending.submitLabel).toBe(copy.submitCreateLoading);
    expect(pending.customerError).toBe(copy.errors.customerRequired);
    expect(pending.itemsError).toBe(copy.errors.itemsRequired);
  });
});
