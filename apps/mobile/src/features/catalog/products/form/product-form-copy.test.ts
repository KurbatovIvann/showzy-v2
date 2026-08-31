import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { productsCopy } from "../../../../i18n/products";
import {
  fieldErrorsFromFormState,
  firstVariantFieldError,
  mapProductFormFailure,
  mapRhfVariantFieldErrors,
  mapValidationIssues,
  overlayVariantFieldErrors,
  resolveProductFormCopy,
  resolveProductFormPresentation,
  rhfPathsForFieldErrors,
} from "./product-form-copy";
import type { ProductFormWrite } from "./product-form-plan";
import { productFormResolver } from "./product-form.schema";

describe("mapProductFormFailure / mapValidationIssues", () => {
  it("maps wire kinds without reading error messages", () => {
    expect(mapProductFormFailure("network")).toBe("network");
    expect(mapProductFormFailure("offline")).toBe("offline");
    expect(mapProductFormFailure("permission")).toBe("permission");
    expect(mapProductFormFailure("conflict", "RETRY_IN_PROGRESS")).toBe(
      "unavailable",
    );
    expect(mapProductFormFailure("validation")).toBe("validation");
  });

  it("maps VALIDATION issues onto fields by path", () => {
    const write: ProductFormWrite = {
      kind: "createProduct",
      input: {
        name: "Торт",
        basePriceMinor: "100",
        currency: "UAH",
        variants: [{ name: "1 кг" }],
      },
      variantKeys: ["draft-1"],
    };
    const error: unknown = new ORPCError("VALIDATION", {
      defined: true,
      status: 400,
      message: "do-not-match-this",
      data: {
        issues: [
          { code: "too_small", path: ["name"], message: "secret" },
          {
            code: "custom",
            path: ["variants", 0, "basePriceMinor"],
            message: "secret",
          },
        ],
      },
    });
    expect(mapValidationIssues(error, write)).toEqual({
      name: "required",
      price: null,
      variants: { "draft-1": { name: null, price: "invalid" } },
    });
  });
});

describe("mapRhfVariantFieldErrors", () => {
  it("maps indexed RHF variant messages onto draft keys", () => {
    expect(
      mapRhfVariantFieldErrors(
        [{ key: "draft-1" }, { key: "draft-2" }, { key: "draft-blank" }],
        [
          { name: { message: "required" } },
          { priceText: { message: "invalid" } },
          undefined,
        ],
      ),
    ).toEqual({
      "draft-1": { name: "required", price: null },
      "draft-2": { name: null, price: "invalid" },
    });
  });

  it("ignores non-key messages and missing rows", () => {
    expect(
      mapRhfVariantFieldErrors([{ key: "draft-1" }], {
        0: { name: { message: "not-a-key" } },
      }),
    ).toEqual({});
    expect(mapRhfVariantFieldErrors([{ key: "draft-1" }], undefined)).toEqual(
      {},
    );
  });
});

describe("overlayVariantFieldErrors", () => {
  it("lets later non-null keys win without wiping the other field", () => {
    expect(
      overlayVariantFieldErrors(
        { "draft-1": { name: null, price: "invalid" } },
        { "draft-1": { name: "required", price: null } },
      ),
    ).toEqual({
      "draft-1": { name: "required", price: "invalid" },
    });
  });
});

describe("fieldErrorsFromFormState", () => {
  it("maps empty name/price submit errors from formState without a clientErrors store", async () => {
    const result = await productFormResolver(
      {
        name: "",
        priceText: "",
        variants: [],
        nextDraftSerial: 1,
      },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        nameMessage: result.errors.name?.message,
        priceMessage: result.errors.priceText?.message,
        variants: [],
        rhfVariants: result.errors.variants,
        server: null,
      }),
    ).toEqual({
      name: "required",
      price: "required",
      variants: {},
    });
  });

  it("ignores resolver messages until submit", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: false,
        nameMessage: "required",
        priceMessage: "required",
        variants: [],
        rhfVariants: undefined,
        server: null,
      }),
    ).toEqual({ name: null, price: null, variants: {} });
  });

  it("overlays wire VALIDATION issues onto the same shape", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        nameMessage: undefined,
        priceMessage: undefined,
        variants: [{ key: "draft-1" }],
        rhfVariants: undefined,
        server: {
          name: "required",
          price: null,
          variants: { "draft-1": { name: null, price: "invalid" } },
        },
      }),
    ).toEqual({
      name: "required",
      price: null,
      variants: { "draft-1": { name: null, price: "invalid" } },
    });
  });

  it("lets formState win on a field and keeps the other from VALIDATION", () => {
    expect(
      fieldErrorsFromFormState({
        submitted: true,
        nameMessage: "too_long",
        priceMessage: undefined,
        variants: [],
        rhfVariants: undefined,
        server: { name: "required", price: "invalid", variants: {} },
      }),
    ).toEqual({ name: "too_long", price: "invalid", variants: {} });
  });
});

describe("rhfPathsForFieldErrors", () => {
  it("turns planner invalid field errors into RHF setError names", () => {
    expect(
      rhfPathsForFieldErrors(
        {
          name: "required",
          price: "required",
          variants: { "draft-1": { name: "required", price: "invalid" } },
        },
        [{ key: "draft-1" }],
      ),
    ).toEqual([
      { name: "name", message: "required" },
      { name: "priceText", message: "required" },
      { name: "variants.0.name", message: "required" },
      { name: "variants.0.priceText", message: "invalid" },
    ]);
  });
});

describe("resolveProductFormPresentation", () => {
  it("chains fieldErrorsFromFormState into resolveProductFormCopy", () => {
    const copy = productsCopy("uk").form;
    const presented = resolveProductFormPresentation({
      copy,
      mode: "create",
      submitted: true,
      nameMessage: "required",
      priceMessage: undefined,
      variants: [],
      rhfVariants: undefined,
      localBanner: null,
      mutationError: null,
      lastWrite: null,
      pending: false,
      clientReady: true,
    });
    const fieldErrors = fieldErrorsFromFormState({
      submitted: true,
      nameMessage: "required",
      priceMessage: undefined,
      variants: [],
      rhfVariants: undefined,
      server: null,
    });
    const resolved = resolveProductFormCopy(copy, {
      mode: "create",
      nameError: fieldErrors.name,
      priceError: fieldErrors.price,
      variantErrors: fieldErrors.variants,
      banner: null,
      pending: false,
      clientReady: true,
    });
    expect(presented).toEqual(resolved);
    expect(presented.nameError).toBe(copy.errors.nameRequired);
  });
});

describe("firstVariantFieldError", () => {
  it("prefers the name message and ignores empty strings", () => {
    expect(firstVariantFieldError(undefined)).toBeNull();
    expect(firstVariantFieldError({ name: null, price: null })).toBeNull();
    expect(firstVariantFieldError({ name: "", price: "Ціна некоректна" })).toBe(
      "Ціна некоректна",
    );
    expect(
      firstVariantFieldError({
        name: "Назва обовʼязкова",
        price: "Ціна некоректна",
      }),
    ).toBe("Назва обовʼязкова");
  });
});
