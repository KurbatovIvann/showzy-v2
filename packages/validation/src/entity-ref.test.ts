import { describe, expect, it } from "vitest";

import {
  ENTITY_REF_QUERY_MAX,
  REFERENCE_CONFLICT_LABELS_MAX,
  candidatesContainingQuery,
  entityRefSchema,
  formatReferenceConflictMessage,
  normalizeReferenceQuery,
  normalizeUniqueMatchQuery,
  pickUniqueNormalizedMatch,
} from "./entity-ref.js";

describe("@showzy/validation/entity-ref", () => {
  it("accepts id or query refs and rejects extras", () => {
    expect(
      entityRefSchema.parse({
        by: "id",
        id: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({
      by: "id",
      id: "11111111-1111-4111-8111-111111111111",
    });
    expect(entityRefSchema.parse({ by: "query", value: "  Katya  " })).toEqual({
      by: "query",
      value: "Katya",
    });
    expect(entityRefSchema.safeParse({ by: "id" }).success).toBe(false);
    expect(
      entityRefSchema.safeParse({ by: "query", value: "   " }).success,
    ).toBe(false);
    expect(
      entityRefSchema.safeParse({
        by: "query",
        value: "x".repeat(ENTITY_REF_QUERY_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      entityRefSchema.safeParse({
        by: "id",
        id: "11111111-1111-4111-8111-111111111111",
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("normalizes NFC, trim, collapsed whitespace, and case-fold", () => {
    expect(normalizeReferenceQuery("  Cafe\u0301   Cake ")).toBe("Café Cake");
    expect(normalizeUniqueMatchQuery("  Cafe\u0301   Cake ")).toBe("café cake");
    expect(normalizeUniqueMatchQuery("KATYA")).toBe("katya");
  });

  it("writes on a unique exact match and conflicts on contains-only", () => {
    const rows = [
      { name: "Katya", phone: "+380501111111" },
      { name: "Katya Keks", phone: "+380502222222" },
    ];
    const fields = (row: (typeof rows)[number]) => [row.name, row.phone];
    expect(pickUniqueNormalizedMatch("Katya", rows, fields)).toEqual({
      kind: "unique",
      row: rows[0],
    });
    expect(pickUniqueNormalizedMatch("Katya Keks", rows, fields).kind).toBe(
      "unique",
    );
    expect(pickUniqueNormalizedMatch("Kat", rows, fields)).toEqual({
      kind: "ambiguous",
      rows,
    });
    expect(pickUniqueNormalizedMatch("nobody", [], fields)).toEqual({
      kind: "none",
    });
    const scoped = candidatesContainingQuery("Katya Keks", rows, fields);
    expect(pickUniqueNormalizedMatch("Katya Keks", scoped, fields).kind).toBe(
      "unique",
    );
  });

  it("caps conflict labels at five", () => {
    expect(REFERENCE_CONFLICT_LABELS_MAX).toBe(5);
    const message = formatReferenceConflictMessage("Katya", [
      "A (…1111)",
      "B (…2222)",
      "C (…3333)",
      "D (…4444)",
      "E (…5555)",
      "F (…6666)",
    ]);
    expect(message).toContain("A (…1111)");
    expect(message).toContain("E (…5555)");
    expect(message).not.toContain("F (…6666)");
  });
});
