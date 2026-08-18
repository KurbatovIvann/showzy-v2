import { describe, expect, it } from "vitest";

import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  IDEMPOTENCY_KEY_HEADER,
} from "./transport-meta.js";

describe("transport-meta header names (contract.md §3)", () => {
  it("pins the canonical names — renames are a breaking client change", () => {
    expect(COMPANY_SELECTOR_HEADER).toBe("x-company-id");
    expect(IDEMPOTENCY_KEY_HEADER).toBe("idempotency-key");
    expect(CONFIRMATION_CHALLENGE_HEADER).toBe("x-confirmation-challenge-id");
  });
});
