/**
 * Customers subdomain import pins (SHO-221). Feature-folder restrictions
 * live in the mobile app ESLint config, not in `packages/tooling` (the
 * workspace package map stays the shared preset).
 *
 * Relative `../<subdomain>/` is the only import shape this slice uses.
 * Absolute `@/` reach-through is not used here; if it appears, document
 * it instead of weakening this regex.
 *
 * Not linted (false-positive risk — see features/customers/AGENTS.md):
 * - `api/` → owning `*-form-plan.ts` write types (golden mutation binders)
 * - `invitations/` → `form/` inherit helpers and `useCustomerFormLookups`
 * - `list/` → groups/counterparties/invitations list panes (CRM home tabs)
 */

/** @param {string[]} names */
function subdomainFrom(names) {
  return `^\\.\\./(${names.join("|")})(/|$)`;
}

export const customersSharedImportRestriction = {
  patterns: [
    {
      regex: subdomainFrom([
        "list",
        "form",
        "groups",
        "counterparties",
        "invitations",
      ]),
      message:
        "customers/shared must not import a feature subdomain (SHO-221).",
    },
  ],
};

export const customersFormImportRestriction = {
  patterns: [
    {
      regex: subdomainFrom(["list", "groups", "counterparties", "invitations"]),
      message:
        "customers/form must not import list/group/counterparty/invitation UI (SHO-221).",
    },
  ],
};

export const customersListImportRestriction = {
  patterns: [
    {
      regex: subdomainFrom(["form"]),
      message:
        "customers/list must not import client-form UI (SHO-221). Compose tab panes from groups/counterparties/invitations only.",
    },
  ],
};

export const customersGroupsImportRestriction = {
  patterns: [
    {
      regex: subdomainFrom(["form", "list", "counterparties", "invitations"]),
      message:
        "customers/groups must not import form/list/counterparty/invitation UI (SHO-221). CRM inherit lookup stays in shared/option-select.ts; picker chrome is components/ui.",
    },
  ],
};

export const customersCounterpartiesImportRestriction = {
  patterns: [
    {
      regex: subdomainFrom(["form", "list", "groups", "invitations"]),
      message:
        "customers/counterparties must not import form/list/group/invitation UI (SHO-221). CRM inherit lookup stays in shared/option-select.ts; picker chrome is components/ui.",
    },
  ],
};

export const customersInvitationsImportRestriction = {
  patterns: [
    {
      regex: subdomainFrom(["list", "groups", "counterparties"]),
      message:
        "customers/invitations must not import list/group/counterparty UI (SHO-221). Client inherit helpers and useCustomerFormLookups may still come from form/.",
    },
  ],
};

export const customersApiImportRestriction = {
  paths: [
    {
      name: "react-hook-form",
      message: "customers/api must not import RHF (SHO-221).",
    },
    {
      name: "react-native",
      message: "customers/api must not import React Native / JSX (SHO-221).",
    },
  ],
};

export const customersBoundaryConfigs = [
  {
    files: ["src/features/customers/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", customersSharedImportRestriction],
    },
  },
  {
    files: ["src/features/customers/form/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", customersFormImportRestriction],
    },
  },
  {
    files: ["src/features/customers/list/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", customersListImportRestriction],
    },
  },
  {
    files: ["src/features/customers/groups/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", customersGroupsImportRestriction],
    },
  },
  {
    files: ["src/features/customers/counterparties/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        customersCounterpartiesImportRestriction,
      ],
    },
  },
  {
    files: ["src/features/customers/invitations/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", customersInvitationsImportRestriction],
    },
  },
  {
    files: ["src/features/customers/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", customersApiImportRestriction],
    },
  },
];
