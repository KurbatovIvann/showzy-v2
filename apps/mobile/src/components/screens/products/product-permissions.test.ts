import { describe, expect, it } from "vitest";

import {
  canCreateProducts,
  canFetchFileDownloadUrls,
} from "./product-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: employees hold
 * neither `products:create` nor `files:view`; owners hold everything
 * implicitly. UI affordance only — the server re-checks permissions.
 */
describe("product permission affordances", () => {
  it("hides the create control only for employees", () => {
    expect(canCreateProducts("owner")).toBe(true);
    expect(canCreateProducts("admin")).toBe(true);
    expect(canCreateProducts("manager")).toBe(true);
    expect(canCreateProducts("employee")).toBe(false);
  });

  it("skips download-url fetches only for employees", () => {
    expect(canFetchFileDownloadUrls("owner")).toBe(true);
    expect(canFetchFileDownloadUrls("admin")).toBe(true);
    expect(canFetchFileDownloadUrls("manager")).toBe(true);
    expect(canFetchFileDownloadUrls("employee")).toBe(false);
  });
});
