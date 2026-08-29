import { describe, expect, it } from "vitest";

import {
  canCreateDocuments,
  canEditDocuments,
  canViewDocuments,
} from "./document-permissions";

/**
 * Mirrors `packages/db/seed/role-permission-defaults.ts`: employees
 * hold `documents:view` only; admin and manager hold view+create+edit;
 * owners hold every permission implicitly. UI affordance only — the
 * server re-checks permissions.
 */
describe("document permission affordances", () => {
  it("lets every staff role open the list (documents:view)", () => {
    expect(canViewDocuments("owner")).toBe(true);
    expect(canViewDocuments("admin")).toBe(true);
    expect(canViewDocuments("manager")).toBe(true);
    expect(canViewDocuments("employee")).toBe(true);
  });

  it("hides create and edit writes only for employees", () => {
    expect(canCreateDocuments("owner")).toBe(true);
    expect(canCreateDocuments("admin")).toBe(true);
    expect(canCreateDocuments("manager")).toBe(true);
    expect(canCreateDocuments("employee")).toBe(false);

    expect(canEditDocuments("owner")).toBe(true);
    expect(canEditDocuments("admin")).toBe(true);
    expect(canEditDocuments("manager")).toBe(true);
    expect(canEditDocuments("employee")).toBe(false);
  });
});
