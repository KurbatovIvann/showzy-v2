import { describe, expect, it } from "vitest";

import { emptyFieldErrors, isItemsErrorKey } from "@showzy/validation/orders";

import { ordersCopy } from "../../../i18n/orders";
import {
  fieldErrorsFromFormState,
  mapLookupListError,
  mapOrderFormFailure,
  mapValidationIssues,
  mapVariantSelectionConflict,
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
            variantSelection: { kind: "base" },
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

describe("mapVariantSelectionConflict", () => {
  it("maps structured variant reasons onto the items/variant picker", () => {
    const required: unknown = {
      code: "CONFLICT",
      status: 409,
      message: "do-not-match-this",
      data: { reason: "variant_required" },
    };
    expect(mapVariantSelectionConflict(required)).toEqual({
      customer: null,
      items: "variant_required",
      comment: null,
    });
    const archivedOnly: unknown = {
      code: "CONFLICT",
      status: 409,
      message: "do-not-match-this",
      data: { reason: "no_active_variants" },
    };
    expect(mapVariantSelectionConflict(archivedOnly)).toEqual({
      customer: null,
      items: "no_active_variants",
      comment: null,
    });
    const stale: unknown = {
      code: "CONFLICT",
      status: 409,
      message: "do-not-match-this",
      data: { reason: "variant_not_found" },
    };
    expect(mapVariantSelectionConflict(stale)).toEqual({
      customer: null,
      items: "variant_required",
      comment: null,
    });
  });

  it("maps a bare wire CONFLICT onto the variant picker, not a dead-end banner", () => {
    const bare: unknown = {
      code: "CONFLICT",
      status: 409,
      message: "do-not-match-this",
    };
    expect(mapVariantSelectionConflict(bare)).toEqual({
      customer: null,
      items: "variant_required",
      comment: null,
    });
    expect(mapOrderFormFailure("conflict", "CONFLICT")).toBe("unavailable");
  });

  it("does not map VALIDATION or retryable 409 codes", () => {
    const validation: unknown = {
      code: "VALIDATION",
      status: 400,
      message: "do-not-match-this",
      data: { issues: [] },
    };
    expect(mapVariantSelectionConflict(validation)).toBeNull();
    const retrying: unknown = {
      code: "RETRY_IN_PROGRESS",
      status: 409,
      message: "do-not-match-this",
      data: { retryAfterSec: 1 },
    };
    expect(mapVariantSelectionConflict(retrying)).toBeNull();
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
        planner: null,
      }),
    ).toEqual({
      customer: "required",
      items: "duplicate",
      comment: "too_long",
    });
    expect(
      fieldErrorsFromFormState({
        submitted: false,
        customerMessage: undefined,
        itemsMessage: undefined,
        commentMessage: undefined,
        server: null,
        planner: { customer: "required", items: "required", comment: null },
      }),
    ).toEqual({
      customer: "required",
      items: "required",
      comment: null,
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
    expect(isItemsErrorKey("variant_required")).toBe(true);
    expect(isItemsErrorKey("no_active_variants")).toBe(true);
    expect(emptyFieldErrors()).toEqual({
      customer: null,
      items: null,
      comment: null,
    });
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

  it("maps variant picker keys onto items copy, not a generic banner", () => {
    const copy = ordersCopy("uk").create;
    const variant = resolveOrderFormCopy(copy, {
      customerError: null,
      itemsError: "variant_required",
      commentError: null,
      banner: null,
      pending: false,
      clientReady: true,
      canCreate: true,
    });
    expect(variant.itemsError).toBe(copy.errors.itemsVariantRequired);
    expect(variant.banner).toBeNull();
    const archived = resolveOrderFormCopy(copy, {
      customerError: null,
      itemsError: "no_active_variants",
      commentError: null,
      banner: null,
      pending: false,
      clientReady: true,
      canCreate: true,
    });
    expect(archived.itemsError).toBe(copy.errors.itemsNoActiveVariants);
    expect(archived.banner).toBeNull();
  });
});

describe("mapLookupListError", () => {
  it("maps list failures by error.code and never error.message", () => {
    const copy = ordersCopy("uk").create;
    expect(
      mapLookupListError(
        copy,
        { code: "INTERNAL", status: 500, message: "secret-list-message" },
        "customers",
      ),
    ).toBe(copy.customersError);
    expect(
      mapLookupListError(
        copy,
        { code: "INTERNAL", status: 500, message: "secret-list-message" },
        "products",
      ),
    ).toBe(copy.productsError);
    expect(
      mapLookupListError(copy, new TypeError("Failed to fetch"), "customers"),
    ).toBe(copy.errors.network);
    expect(
      mapLookupListError(
        copy,
        { code: "INTERNAL", status: 500, message: "secret-list-message" },
        "customers",
      ),
    ).not.toBe("secret-list-message");
    expect(mapLookupListError(copy, null, "customers")).toBeNull();
  });
});
