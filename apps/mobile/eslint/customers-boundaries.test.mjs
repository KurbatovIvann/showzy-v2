import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import {
  customersApiImportRestriction,
  customersBoundaryConfigs,
  customersCounterpartiesImportRestriction,
  customersFormImportRestriction,
  customersGroupsImportRestriction,
  customersInvitationsImportRestriction,
  customersListImportRestriction,
  customersSharedImportRestriction,
} from "./customers-boundaries.mjs";

/**
 * @param {string} specifier
 * @param {object} restriction
 */
function lintImport(specifier, restriction) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(`import { x } from "${specifier}";`, {
    languageOptions: { sourceType: "module", ecmaVersion: 2022 },
    rules: {
      "no-restricted-imports": ["error", restriction],
    },
  });
}

/**
 * @param {import("eslint").Linter.LintMessage[]} messages
 */
function restricted(messages) {
  return messages.filter(
    (message) => message.ruleId === "no-restricted-imports",
  );
}

describe("customers subdomain import pins (SHO-221)", () => {
  it("wires one restriction block per Customers folder", () => {
    const files = customersBoundaryConfigs.map((config) => config.files[0]);
    expect(files).toEqual([
      "src/features/customers/shared/**/*.{ts,tsx}",
      "src/features/customers/form/**/*.{ts,tsx}",
      "src/features/customers/list/**/*.{ts,tsx}",
      "src/features/customers/groups/**/*.{ts,tsx}",
      "src/features/customers/counterparties/**/*.{ts,tsx}",
      "src/features/customers/invitations/**/*.{ts,tsx}",
      "src/features/customers/api/**/*.{ts,tsx}",
    ]);
  });

  it("forbids shared from reaching a feature subdomain", () => {
    expect(
      restricted(
        lintImport(
          "../form/customer-form-pickers",
          customersSharedImportRestriction,
        ),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport("../list/client-row", customersSharedImportRestriction),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport("../groups/group-row", customersSharedImportRestriction),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport("../api/customer.queries", customersSharedImportRestriction),
      ),
    ).toHaveLength(0);
    expect(
      restricted(
        lintImport("./option-select", customersSharedImportRestriction),
      ),
    ).toHaveLength(0);
  });

  it("forbids form from depending on other UI subdomains", () => {
    expect(
      restricted(
        lintImport("../groups/group-form-view", customersFormImportRestriction),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport("../list/clients-list-pane", customersFormImportRestriction),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport(
          "../counterparties/counterparty-row",
          customersFormImportRestriction,
        ),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport(
          "../invitations/invitation-form-view",
          customersFormImportRestriction,
        ),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport("../api/customer.queries", customersFormImportRestriction),
      ),
    ).toHaveLength(0);
    expect(
      restricted(
        lintImport("../shared/option-select", customersFormImportRestriction),
      ),
    ).toHaveLength(0);
  });

  it("forbids list from importing client-form UI, not tab panes", () => {
    expect(
      restricted(
        lintImport(
          "../form/customer-form-screen",
          customersListImportRestriction,
        ),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport(
          "../groups/groups-list-pane",
          customersListImportRestriction,
        ),
      ),
    ).toHaveLength(0);
    expect(
      restricted(
        lintImport("../shared/customer-hrefs", customersListImportRestriction),
      ),
    ).toHaveLength(0);
  });

  it("forbids groups and counterparties from importing form pickers", () => {
    expect(
      restricted(
        lintImport(
          "../form/customer-form-pickers",
          customersGroupsImportRestriction,
        ),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport("../shared/option-select", customersGroupsImportRestriction),
      ),
    ).toHaveLength(0);
    expect(
      restricted(
        lintImport(
          "../form/customer-form-pickers",
          customersCounterpartiesImportRestriction,
        ),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport(
          "../shared/option-select",
          customersCounterpartiesImportRestriction,
        ),
      ),
    ).toHaveLength(0);
  });

  it("allows invitations to import form inherit helpers, not other UI", () => {
    expect(
      restricted(
        lintImport(
          "../form/customer-form-pickers",
          customersInvitationsImportRestriction,
        ),
      ),
    ).toHaveLength(0);
    expect(
      restricted(
        lintImport(
          "../form/use-customer-form-lookups",
          customersInvitationsImportRestriction,
        ),
      ),
    ).toHaveLength(0);
    expect(
      restricted(
        lintImport(
          "../list/clients-list-pane",
          customersInvitationsImportRestriction,
        ),
      ),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport(
          "../groups/use-group-form",
          customersInvitationsImportRestriction,
        ),
      ),
    ).toHaveLength(1);
  });

  it("forbids api from importing RHF or React Native, not plan types", () => {
    expect(
      restricted(lintImport("react-hook-form", customersApiImportRestriction)),
    ).toHaveLength(1);
    expect(
      restricted(lintImport("react-native", customersApiImportRestriction)),
    ).toHaveLength(1);
    expect(
      restricted(
        lintImport("../form/customer-form-plan", customersApiImportRestriction),
      ),
    ).toHaveLength(0);
    expect(
      restricted(
        lintImport("../groups/group-form-plan", customersApiImportRestriction),
      ),
    ).toHaveLength(0);
  });
});
