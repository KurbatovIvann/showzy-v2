import { describe, expect, it } from "vitest";

import {
  canCreateProducts,
  canEditProducts,
  canFetchFileDownloadUrls,
  canUploadFiles,
} from "./product-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: employees hold
 * neither `products:create`, `products:edit`, `files:upload`, nor
 * `files:view`; owners hold everything implicitly. UI affordance only —
 * the server re-checks permissions.
 */
describe("product permission affordances", () => {
  it("hides the create control only for employees", () => {
    expect(canCreateProducts("owner")).toBe(true);
    expect(canCreateProducts("admin")).toBe(true);
    expect(canCreateProducts("manager")).toBe(true);
    expect(canCreateProducts("employee")).toBe(false);
  });

  it("hides archive/restore and edit controls only for employees", () => {
    expect(canEditProducts("owner")).toBe(true);
    expect(canEditProducts("admin")).toBe(true);
    expect(canEditProducts("manager")).toBe(true);
    expect(canEditProducts("employee")).toBe(false);
  });

  it("skips download-url fetches only for employees", () => {
    expect(canFetchFileDownloadUrls("owner")).toBe(true);
    expect(canFetchFileDownloadUrls("admin")).toBe(true);
    expect(canFetchFileDownloadUrls("manager")).toBe(true);
    expect(canFetchFileDownloadUrls("employee")).toBe(false);
  });

  it("keeps canEditProducts identical to canFetchFileDownloadUrls for every seeded role", () => {
    for (const role of ["owner", "admin", "manager", "employee"] as const) {
      expect(canEditProducts(role)).toBe(canFetchFileDownloadUrls(role));
    }
  });

  it("hides the photo attach handshake only for employees", () => {
    expect(canUploadFiles("owner")).toBe(true);
    expect(canUploadFiles("admin")).toBe(true);
    expect(canUploadFiles("manager")).toBe(true);
    expect(canUploadFiles("employee")).toBe(false);
  });
});
