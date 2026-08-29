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
import { docGenerationSuiteCoverage } from "@showzy/doc-generation/suite-coverage";
import { documentsSuiteCoverage } from "@showzy/documents/suite-coverage";
import { filesSuiteCoverage } from "@showzy/files/suite-coverage";
import { invitesSuiteCoverage } from "@showzy/invites/suite-coverage";
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
  it("index.ts warns when the S3 signing host is loopback", () => {
    const indexSource = readFileSync(
      join(import.meta.dirname, "index.ts"),
      "utf8",
    );
    expect(indexSource).toContain("s3DeviceSigningWarning");
    expect(indexSource).toContain("S3_LOOPBACK_SIGNING_WARNING");
  });

  it("boot.ts uses createActionRegistry from this module", () => {
    const bootSource = readFileSync(
      join(import.meta.dirname, "boot.ts"),
      "utf8",
    );
    expect(bootSource).toContain('from "./composition.js"');
    expect(bootSource).toContain("createActionRegistry");
    expect(bootSource).toContain("createRedisAuthRateLimitStore(redis, {");
    expect(bootSource).toContain("ipHmacSecret: config.rateLimit.ipHmacSecret");
    expect(bootSource).toContain("configureFilesObjectStore");
    expect(bootSource).toContain("probeFilesObjectStore");
    expect(bootSource).toContain("closeFilesObjectStore");
    expect(bootSource).toContain("configureDocumentShareOrigin");
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
        documentsSuiteCoverage,
        docGenerationSuiteCoverage,
        filesSuiteCoverage,
        invitesSuiteCoverage,
        ordersSuiteCoverage,
        pricingSuiteCoverage,
      ]),
    );
  });

  it("documents.createFromOrder nested reads omit companies.get", () => {
    const source = readFileSync(
      join(import.meta.dirname, "composition.ts"),
      "utf8",
    );
    const edges: Array<{ caller: string; callee: string }> = [];
    const edgeRe = /caller:\s*"([^"]+)",\s*\n\s*callee:\s*"([^"]+)"/g;
    for (const match of source.matchAll(edgeRe)) {
      const caller = match[1];
      const callee = match[2];
      if (caller !== undefined && callee !== undefined) {
        edges.push({ caller, callee });
      }
    }
    const fromCreate = edges.filter(
      (edge) => edge.caller === "documents.createFromOrder",
    );
    expect(fromCreate.map((edge) => edge.callee).toSorted()).toEqual([
      "companies.getSellerFacts",
      "customers.getCounterparty",
      "customers.getCustomer",
      "orders.get",
    ]);
    expect(fromCreate.map((edge) => edge.callee)).not.toContain(
      "companies.get",
    );
  });

  it("documents.share nests files.issueShareDownloadUrl", () => {
    const source = readFileSync(
      join(import.meta.dirname, "composition.ts"),
      "utf8",
    );
    const edges: Array<{ caller: string; callee: string }> = [];
    const edgeRe = /caller:\s*"([^"]+)",\s*\n\s*callee:\s*"([^"]+)"/g;
    for (const match of source.matchAll(edgeRe)) {
      const caller = match[1];
      const callee = match[2];
      if (caller !== undefined && callee !== undefined) {
        edges.push({ caller, callee });
      }
    }
    expect(
      edges
        .filter((edge) => edge.caller === "documents.share")
        .map((edge) => edge.callee)
        .toSorted(),
    ).toEqual(["docGeneration.getArtifact", "files.issueShareDownloadUrl"]);
  });

  it("documents.get nests getArtifact and the documents:view PDF URL", () => {
    const source = readFileSync(
      join(import.meta.dirname, "composition.ts"),
      "utf8",
    );
    const edges: Array<{ caller: string; callee: string }> = [];
    const edgeRe = /caller:\s*"([^"]+)",\s*\n\s*callee:\s*"([^"]+)"/g;
    for (const match of source.matchAll(edgeRe)) {
      const caller = match[1];
      const callee = match[2];
      if (caller !== undefined && callee !== undefined) {
        edges.push({ caller, callee });
      }
    }
    expect(
      edges
        .filter((edge) => edge.caller === "documents.get")
        .map((edge) => edge.callee)
        .toSorted(),
    ).toEqual(["docGeneration.getArtifact", "files.issueDocumentDownloadUrl"]);
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
