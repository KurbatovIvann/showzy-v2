import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  firstVariantFieldError,
  mapProductFormFailure,
  mapValidationIssues,
} from "./product-form-copy";
import type { ProductFormWrite } from "./product-form-plan";

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
