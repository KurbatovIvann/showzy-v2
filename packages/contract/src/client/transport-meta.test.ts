import { describe, expect, it } from "vitest";

import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  IDEMPOTENCY_KEY_HEADER,
} from "./transport-meta.js";
import * as transportMeta from "./transport-meta.js";

describe("transport-meta header names (contract.md §3)", () => {
  it("pins the canonical names — renames are a breaking client change", () => {
    expect(COMPANY_SELECTOR_HEADER).toBe("x-company-id");
    expect(IDEMPOTENCY_KEY_HEADER).toBe("idempotency-key");
    expect(CONFIRMATION_CHALLENGE_HEADER).toBe("x-confirmation-challenge-id");
  });

  it("does not export a share-token header — the capability token is action input (ADR-0022)", () => {
    expect(Object.keys(transportMeta).some((name) => /share/i.test(name))).toBe(
      false,
    );
    expect(JSON.stringify(transportMeta)).not.toContain("x-share-token");
  });
});
