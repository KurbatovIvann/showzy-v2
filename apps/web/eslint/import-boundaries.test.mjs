/**
 * Boundary proof (SHO-309): the app's own ESLint config must reject
 * `@showzy/contract/server`, module packages, and platform server packages
 * from `apps/web` while allowing the client allowlist (contract.md §2,
 * ADR-0030). The rule under test is extracted from this package's real
 * `eslint.config.mjs`, not re-implemented.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import webEslintConfig from "../eslint.config.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const showzyEntry = webEslintConfig.find(
  (entry) => entry.plugins?.showzy !== undefined,
);
if (showzyEntry === undefined) {
  throw new Error("eslint.config.mjs no longer wires the showzy plugin");
}
const showzyPlugin = showzyEntry.plugins.showzy;

/**
 * @param {string} appRelativeFile
 * @param {string} code
 */
function lintAsWebFile(appRelativeFile, code) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    {
      // Flat-config Linter only applies configs whose `files` match the
      // linted filename; the default patterns cover .js only.
      files: ["**/*.ts", "**/*.tsx"],
      plugins: { showzy: showzyPlugin },
      languageOptions: { sourceType: "module", ecmaVersion: 2022 },
      rules: { "showzy/import-boundaries": "error" },
    },
    path.join(repoRoot, "apps/web", appRelativeFile),
  );
}

/**
 * @param {import("eslint").Linter.LintMessage[]} messages
 */
function boundaryErrors(messages) {
  return messages.filter(
    (message) => message.ruleId === "showzy/import-boundaries",
  );
}

describe("apps/web clientApp import boundary (SHO-309)", () => {
  it("keeps showzy/import-boundaries as an error in the app config", () => {
    const wired = webEslintConfig.some(
      (entry) => entry.rules?.["showzy/import-boundaries"] === "error",
    );
    expect(wired).toBe(true);
  });

  it("rejects @showzy/contract/server from app code", () => {
    const messages = boundaryErrors(
      lintAsWebFile(
        "src/api/contract-client.ts",
        `import { buildServerRouter } from "@showzy/contract/server";`,
      ),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("Client apps may import only");
  });

  it("rejects module packages from app code", () => {
    expect(
      boundaryErrors(
        lintAsWebFile(
          "src/features/orders/api/orders.queries.ts",
          `import { ordersConfirm } from "@showzy/orders";`,
        ),
      ),
    ).toHaveLength(1);
    expect(
      boundaryErrors(
        lintAsWebFile(
          "src/routes/index.tsx",
          `import { customersContract } from "@showzy/customers/contract";`,
        ),
      ),
    ).toHaveLength(1);
  });

  it("rejects platform server packages from app code", () => {
    for (const specifier of ["@showzy/core", "@showzy/db", "@showzy/config"]) {
      expect(
        boundaryErrors(
          lintAsWebFile(
            "src/main.tsx",
            `import { anything } from "${specifier}";`,
          ),
        ),
      ).toHaveLength(1);
    }
  });

  it("allows the client allowlist and plain npm packages", () => {
    const messages = boundaryErrors(
      lintAsWebFile(
        "src/api/contract-client.ts",
        `
          import { createContractClient } from "@showzy/contract";
          import { moneySchema } from "@showzy/validation";
          import { Button } from "@showzy/ui";
          import { createWebAdapter } from "@showzy/document-signing/web";
          import { useQuery } from "@tanstack/react-query";
          import { createFileRoute } from "@tanstack/react-router";
          import { useState } from "react";
        `,
      ),
    );
    expect(messages).toHaveLength(0);
  });
});
