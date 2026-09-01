import { describe, expect, it } from "vitest";

import {
  RESOLVE_LINE_REFERENCES_MAX_LINES,
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
    expect(RESOLVE_LINE_REFERENCES_MAX_LINES).toBe(100);
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
});
