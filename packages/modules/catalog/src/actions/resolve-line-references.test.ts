import { REFERENCE_CONFLICT_LABELS_MAX } from "@showzy/validation/entity-ref";
import { describe, expect, it } from "vitest";

import {
  RESOLVE_LINE_REFERENCES_MAX_LINES,
  VARIANT_AND_SELECTION_EXCLUSIVE_MESSAGE,
  VARIANT_SELECTION_OPTIONS_MAX,
  resolveLineReferencesContract,
} from "./resolve-line-references.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("catalog.resolveLineReferences contract", () => {
  it("is a staff internal read with products:view", () => {
    expect(resolveLineReferencesContract.name).toBe(
      "catalog.resolveLineReferences",
    );
    expect(resolveLineReferencesContract.principal).toBe("staff");
    expect(resolveLineReferencesContract.transport).toBe("internal");
    expect(resolveLineReferencesContract.risk).toBe("read");
    expect(resolveLineReferencesContract.permissions).toEqual([
      "products:view",
    ]);
    expect(resolveLineReferencesContract.aiExposure).toBe("internal");
    expect(resolveLineReferencesContract.audit).toBe(false);
    expect(resolveLineReferencesContract.idempotent).toBe(false);
    expect(resolveLineReferencesContract.emits).toEqual([]);
    expect(resolveLineReferencesContract.timeout).toBe(5_000);
    expect(resolveLineReferencesContract.description).toContain(
      "Product query matches include active and archived rows",
    );
    expect(resolveLineReferencesContract.description).toContain(
      "Product and variant ids must be active",
    );
    expect(resolveLineReferencesContract.description).toContain(
      "reason archived, empty options",
    );
    expect(RESOLVE_LINE_REFERENCES_MAX_LINES).toBe(100);
    expect(VARIANT_SELECTION_OPTIONS_MAX).toBe(20);
    expect(VARIANT_SELECTION_OPTIONS_MAX).toBeGreaterThan(6);
    expect(VARIANT_SELECTION_OPTIONS_MAX).not.toBe(
      REFERENCE_CONFLICT_LABELS_MAX,
    );
  });

  it("accepts 1–100 lines of EntityRef products and rejects extras", () => {
    expect(
      resolveLineReferencesContract.input.parse({
        lines: [{ product: { by: "id", id: validId } }],
      }),
    ).toEqual({
      lines: [{ product: { by: "id", id: validId } }],
    });
    expect(
      resolveLineReferencesContract.input.parse({
        lines: [
          {
            product: { by: "query", value: "  Coat  " },
            variant: { by: "query", value: "Red" },
          },
        ],
      }),
    ).toEqual({
      lines: [
        {
          product: { by: "query", value: "Coat" },
          variant: { by: "query", value: "Red" },
        },
      ],
    });
    expect(
      resolveLineReferencesContract.input.safeParse({ lines: [] }).success,
    ).toBe(false);
    expect(
      resolveLineReferencesContract.input.safeParse({
        lines: Array.from({ length: 101 }, () => ({
          product: { by: "id", id: validId },
        })),
      }).success,
    ).toBe(false);
    expect(
      resolveLineReferencesContract.input.safeParse({
        lines: [{ product: { by: "id", id: validId } }],
        companyId: validId,
      }).success,
    ).toBe(false);
  });

  it("accepts additive variantSelection and keeps legacy variant exclusive", () => {
    expect(
      resolveLineReferencesContract.input.parse({
        lines: [
          {
            product: { by: "id", id: validId },
            variantSelection: { kind: "unspecified" },
          },
          {
            product: { by: "id", id: validId },
            variantSelection: { kind: "base" },
          },
          {
            product: { by: "id", id: validId },
            variantSelection: {
              kind: "reference",
              ref: { by: "query", value: "  Lemon  " },
            },
          },
        ],
      }),
    ).toEqual({
      lines: [
        {
          product: { by: "id", id: validId },
          variantSelection: { kind: "unspecified" },
        },
        {
          product: { by: "id", id: validId },
          variantSelection: { kind: "base" },
        },
        {
          product: { by: "id", id: validId },
          variantSelection: {
            kind: "reference",
            ref: { by: "query", value: "Lemon" },
          },
        },
      ],
    });
    const both = resolveLineReferencesContract.input.safeParse({
      lines: [
        {
          product: { by: "id", id: validId },
          variant: { by: "id", id: validId },
          variantSelection: { kind: "base" },
        },
      ],
    });
    expect(both.success).toBe(false);
    if (both.success) {
      return;
    }
    expect(JSON.stringify(both.error.issues)).toContain(
      VARIANT_AND_SELECTION_EXCLUSIVE_MESSAGE,
    );
  });
});
