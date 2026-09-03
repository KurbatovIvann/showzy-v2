/**
 * Fixture unit tests for the Playwright RPC/auth boundary (SHO-331).
 * Not a domain E2E suite.
 */
// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BAKERY_COMPANY_ID,
  BAKERY_MEMBERSHIP,
  FLOWERS_COMPANY_ID,
  FLOWERS_MEMBERSHIP,
} from "../src/test/company-fixtures";
import {
  fulfillCompaniesGet,
  isAuthGetSessionPath,
  UNMOCKED_RPC_NOT_FOUND,
} from "./panel-api";

describe("panel smoke companies.get boundary", () => {
  const memberships = [FLOWERS_MEMBERSHIP, BAKERY_MEMBERSHIP];

  it("returns the membership company on a matching x-company-id", () => {
    expect(fulfillCompaniesGet(memberships, FLOWERS_COMPANY_ID)).toEqual({
      status: 200,
      body: {
        json: {
          id: FLOWERS_COMPANY_ID,
          name: FLOWERS_MEMBERSHIP.company.name,
          slug: FLOWERS_MEMBERSHIP.company.slug,
          prefix: FLOWERS_MEMBERSHIP.company.prefix,
          legal: null,
        },
      },
    });
    expect(fulfillCompaniesGet(memberships, BAKERY_COMPANY_ID).status).toBe(
      200,
    );
  });

  it("does not mint a synthetic tenant for a missing or foreign header", () => {
    const missing = fulfillCompaniesGet(memberships, undefined);
    const empty = fulfillCompaniesGet(memberships, "");
    const foreign = fulfillCompaniesGet(
      memberships,
      "c0c0c0c0-0000-4000-8000-000000000099",
    );

    expect(missing).toEqual({ status: 404, body: UNMOCKED_RPC_NOT_FOUND });
    expect(empty).toEqual({ status: 404, body: UNMOCKED_RPC_NOT_FOUND });
    expect(foreign).toEqual({ status: 404, body: UNMOCKED_RPC_NOT_FOUND });
    expect(JSON.stringify(foreign)).not.toMatch(/"slug":"unknown"/);
    expect(JSON.stringify(foreign)).not.toContain(
      "c0c0c0c0-0000-4000-8000-000000000099",
    );
  });

  it("does not hardcode a synthetic unknown tenant in the fixture", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "panel-api.ts"),
      "utf8",
    );
    expect(source).not.toContain('?? "unknown"');
    expect(source).not.toContain("c0c0c0c0-0000-4000-8000-000000000099");
    expect(source).toContain("**/rpc/orders/list");
  });
});

describe("panel smoke auth boundary", () => {
  it("treats only get-session as the session mock", () => {
    expect(isAuthGetSessionPath("/api/auth/get-session")).toBe(true);
    expect(isAuthGetSessionPath("/api/auth/sign-out")).toBe(false);
    expect(
      isAuthGetSessionPath("/api/auth/email-otp/send-verification-otp"),
    ).toBe(false);
  });
});
