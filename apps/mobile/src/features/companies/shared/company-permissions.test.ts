import { describe, expect, it } from "vitest";

import { canViewCompanySettings } from "./company-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`:
 * `settings:payments` is seeded for admin; owners hold every permission
 * implicitly; manager and employee do not hold the key. UI affordance
 * only — the server re-checks permissions.
 */
describe("company settings permission affordances", () => {
  it("lets owner and admin open the company settings hub", () => {
    expect(canViewCompanySettings("owner")).toBe(true);
    expect(canViewCompanySettings("admin")).toBe(true);
  });

  it("is not a working path for manager or employee", () => {
    expect(canViewCompanySettings("manager")).toBe(false);
    expect(canViewCompanySettings("employee")).toBe(false);
  });
});
