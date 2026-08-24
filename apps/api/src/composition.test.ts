/**
 * Composition-root identity and the suite-coverage gate the CI stage
 * relies on (fnd-G1 A2). The green-path stage itself lives in
 * `composition.contract-check.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { catalogSuiteCoverage } from "@showzy/catalog/suite-coverage";
import { chatSuiteCoverage } from "@showzy/chat/suite-coverage";
import { companiesSuiteCoverage } from "@showzy/companies/suite-coverage";
import { customersSuiteCoverage } from "@showzy/customers/suite-coverage";
import { filesSuiteCoverage } from "@showzy/files/suite-coverage";
import { ordersSuiteCoverage } from "@showzy/orders/suite-coverage";
import { pricingSuiteCoverage } from "@showzy/pricing/suite-coverage";
import { implementAction, runContractCheck } from "@showzy/core";
import { defineActionContract } from "@showzy/core/contract";
import { projectionGrants } from "@showzy/db";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildContractCheckInput,
  createActionRegistry,
  mergeSuiteCoverage,
  registerAction,
} from "./composition.js";

const io = z.object({});

function actionNames(
  registry: ReturnType<typeof createActionRegistry>,
): string[] {
  return registry
    .contracts()
    .map((contract) => contract.name)
    .toSorted();
}

describe("composition root identity", () => {
  it("boot.ts uses createActionRegistry from this module", () => {
    const bootSource = readFileSync(
      join(import.meta.dirname, "boot.ts"),
      "utf8",
    );
    expect(bootSource).toContain('from "./composition.js"');
    expect(bootSource).toContain("createActionRegistry");
    expect(bootSource).toContain("configureFilesObjectStore");
    expect(bootSource).toContain("probeFilesObjectStore");
    expect(bootSource).toContain("closeFilesObjectStore");
    expect(bootSource).not.toMatch(/new ActionRegistry\s*\(/);
  });

  it("the contract-check input is the boot registry plus the db grant manifest", () => {
    const input = buildContractCheckInput();
    expect(actionNames(input.registry)).toEqual(
      actionNames(createActionRegistry()),
    );
    expect(
      input.registry
        .implementations()
        .map((implementation) => implementation.contract.name)
        .toSorted(),
    ).toEqual(actionNames(createActionRegistry()));
    expect(input.projectionGrants).toBe(projectionGrants);
    expect(input.suiteCoverage).toEqual(
      mergeSuiteCoverage([
        catalogSuiteCoverage,
        chatSuiteCoverage,
        companiesSuiteCoverage,
        customersSuiteCoverage,
        filesSuiteCoverage,
        ordersSuiteCoverage,
        pricingSuiteCoverage,
      ]),
    );
  });
});

describe("composition suiteCoverage gate", () => {
  it("fails the contract check when a boot-registered action is omitted from suiteCoverage", () => {
    const contract = defineActionContract({
      name: "coverageProbe.get",
      description: "Staff read used to prove the suiteCoverage omission gate.",
      principal: "staff",
      transport: "client",
      input: io,
      output: io,
      permissions: ["coverageProbe:view"],
      aiExposure: "internal",
      risk: "read",
      requiresConfirmation: false,
      idempotent: false,
      emits: [],
      atomicCalls: [],
      atomicCallers: [],
      audit: false,
      timeout: 5_000,
    });
    const registry = createActionRegistry();
    registerAction(
      registry,
      implementAction(contract, {
        handler: () => Promise.resolve({}),
      }),
    );

    const result = runContractCheck({
      ...buildContractCheckInput(),
      registry,
    });

    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      'action "coverageProbe.get": missing crossTenantSuite instantiation (core.md §12)',
    ]);
  });
});
