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

  it("maps VALIDATION issues onto fields by path, never by message", () => {
    const write: OrderFormWrite = {
      kind: "createOrder",
      input: {
        customer: { by: "id", id: CUSTOMER_ID },
        items: [
          {
            product: { by: "id", id: PRODUCT_ID },
            quantity: { milli: "1000" },
          },
        ],
      },
    };
    const error: unknown = {
      code: "VALIDATION",
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_small", path: ["customer"], message: "secret" },
          { code: "too_small", path: ["items"], message: "secret" },
          { code: "too_big", path: ["comment"], message: "secret" },
        ],
      },
    };
    expect(mapValidationIssues(error, write)).toEqual({
      customer: "required",
      items: "required",
      comment: "too_long",
    });
    expect(JSON.stringify(mapValidationIssues(error, write))).not.toContain(
      "do-not-match-this",
    );
    expect(JSON.stringify(mapValidationIssues(error, write))).not.toContain(
      "secret",
    );
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
        items: "required",
        comment: null,
      }),
    ).toEqual([
      { name: "customerId", message: "required" },
      { name: "items", message: "required" },
    ]);
    expect(rhfItemsMessage({ root: { message: "required" } })).toBe("required");
  });
});

describe("resolveOrderFormCopy", () => {
  it("hides submit without orders:create and never uses error.message", () => {
    const copy = ordersCopy("uk").create;
    const hidden = resolveOrderFormCopy(copy, {
      customerError: null,
      itemsError: null,
      commentError: null,
      banner: "permission",
      pending: false,
      clientReady: true,
      canCreate: false,
    });
    expect(hidden.showSubmit).toBe(false);
    expect(hidden.banner).toBe(copy.errors.permission);
    expect(hidden.banner).not.toBe("do-not-match-this");
  });
});
