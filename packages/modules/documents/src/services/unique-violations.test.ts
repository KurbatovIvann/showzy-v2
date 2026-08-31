import { ConcurrentRetryError, ConflictError } from "@showzy/core/errors";
import { describe, expect, it } from "vitest";

import {
  DOCUMENTS_LIVE_ORDER_TYPE_UQ,
  DUPLICATE_LIVE_DOCUMENT_MESSAGE,
  SHARE_ACTIVE_TOKEN_UQ,
  mapLiveDocumentUniqueViolation,
  mapShareActiveTokenUniqueViolation,
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

describe("mapShareActiveTokenUniqueViolation", () => {
  it("maps the active-token unique index to ConcurrentRetryError", () => {
    const mapped = mapShareActiveTokenUniqueViolation({
      code: "23505",
      constraint: SHARE_ACTIVE_TOKEN_UQ,
    });
    expect(mapped).toBeInstanceOf(ConcurrentRetryError);
  });

  it("leaves other errors unchanged", () => {
    const other = { code: "23505", constraint: "other_uq" };
    expect(mapShareActiveTokenUniqueViolation(other)).toBe(other);
  });
});
