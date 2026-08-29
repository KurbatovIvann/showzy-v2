import { ConflictError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import { postgresUniqueConstraint } from "./postgres-unique.js";
import {
  DOCUMENTS_LIVE_ORDER_TYPE_UQ,
  DUPLICATE_LIVE_DOCUMENT_MESSAGE,
  mapLiveDocumentUniqueViolation,
} from "./unique-violations.js";

describe("mapLiveDocumentUniqueViolation", () => {
  it("maps documents_company_order_type_live_uq (SQLSTATE 23505) to ConflictError", () => {
    const mapped = mapLiveDocumentUniqueViolation({
      code: "23505",
      constraint: DOCUMENTS_LIVE_ORDER_TYPE_UQ,
    });
    expect(mapped).toBeInstanceOf(ConflictError);
    if (mapped instanceof ConflictError) {
      expect(mapped.clientMessage).toBe(DUPLICATE_LIVE_DOCUMENT_MESSAGE);
    }
  });

  it("leaves other errors unchanged", () => {
    const other = { code: "23505", constraint: "other_uq" };
    expect(mapLiveDocumentUniqueViolation(other)).toBe(other);
    const plain = new Error("nope");
    expect(mapLiveDocumentUniqueViolation(plain)).toBe(plain);
  });
});

describe("postgresUniqueConstraint", () => {
  it("walks a wrapped cause chain", () => {
    expect(
      postgresUniqueConstraint({
        cause: { code: "23505", constraint: DOCUMENTS_LIVE_ORDER_TYPE_UQ },
      }),
    ).toBe(DOCUMENTS_LIVE_ORDER_TYPE_UQ);
    expect(postgresUniqueConstraint(undefined)).toBeUndefined();
  });
});
