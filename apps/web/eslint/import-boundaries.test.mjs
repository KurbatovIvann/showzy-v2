/**
 * Boundary proof (SHO-309): the app's own ESLint config must reject
 * `@showzy/contract/server`, module packages, and platform server packages
 * from `apps/web` while allowing the client allowlist (contract.md §2,
 * ADR-0030). Probe snippets are written as real files under `src/` and
 * linted with the FULL config array exported by this package's real
 * `eslint.config.mjs`, so a future `ignores` entry (or any other config
 * change) that stopped the boundary from firing would fail these tests.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import webEslintConfig from "../eslint.config.mjs";

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const probeDirectory = path.join(appRoot, "src", "__boundary-probe__");

/**
 * Probe files created under `src/` for the duration of this suite. Real
 * files (not virtual filenames) so the config's type-aware parsing and any
 * `ignores` entries apply exactly as they do when CI runs `eslint .`.
 */
const probeFiles = {
  "contract-server.ts": `import { buildServerRouter } from "@showzy/contract/server";\n`,
  "module-orders.ts": `import { ordersConfirm } from "@showzy/orders";\n`,
  "module-customers-contract.ts": `import { customersContract } from "@showzy/customers/contract";\n`,
  "platform-core.ts": `import { anything } from "@showzy/core";\n`,
  "platform-db.ts": `import { anything } from "@showzy/db";\n`,
  "platform-config.ts": `import { anything } from "@showzy/config";\n`,
  "platform-ai.ts": `import { anything } from "@showzy/ai";\n`,
  "client-allowlist.ts": `
    import { createContractClient } from "@showzy/contract";
    import { moneySchema } from "@showzy/validation";
    import { Button } from "@showzy/ui";
    import { createWebAdapter } from "@showzy/document-signing/web";
    import { useQuery } from "@tanstack/react-query";
    import { createFileRoute } from "@tanstack/react-router";
    import { useState } from "react";
  `,
};

/** @type {Map<string, import("eslint").Linter.LintMessage[]>} */
let messagesByProbe = new Map();

beforeAll(async () => {
  await mkdir(probeDirectory, { recursive: true });
  await Promise.all(
    Object.entries(probeFiles).map(([name, code]) =>
      writeFile(path.join(probeDirectory, name), code),
    ),
  );
  const eslint = new ESLint({
    cwd: appRoot,
    // The whole exported config array — no synthetic wrapper config, so
    // `ignores` entries and every other real config entry stay in force.
    overrideConfigFile: true,
    overrideConfig: webEslintConfig,
  });
  const results = await eslint.lintFiles(
    Object.keys(probeFiles).map((name) => path.join(probeDirectory, name)),
  );
  messagesByProbe = new Map(
    results.map((result) => [path.basename(result.filePath), result.messages]),
  );
}, 120_000);

afterAll(async () => {
  await rm(probeDirectory, { recursive: true, force: true });
});

/**
 * @param {string} probeName
 */
function boundaryErrors(probeName) {
  const messages = messagesByProbe.get(probeName);
  if (messages === undefined) {
    throw new Error(`probe ${probeName} was not linted`);
  }
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
    const messages = boundaryErrors("contract-server.ts");
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("Client apps may import only");
  });

  it("rejects module packages from app code", () => {
    expect(boundaryErrors("module-orders.ts")).toHaveLength(1);
    expect(boundaryErrors("module-customers-contract.ts")).toHaveLength(1);
  });

  it("rejects platform server packages from app code", () => {
    for (const probeName of [
      "platform-core.ts",
      "platform-db.ts",
      "platform-config.ts",
      "platform-ai.ts",
    ]) {
      expect(boundaryErrors(probeName)).toHaveLength(1);
    }
  });

  it("allows the client allowlist and plain npm packages", () => {
    expect(boundaryErrors("client-allowlist.ts")).toHaveLength(0);
  });
});
