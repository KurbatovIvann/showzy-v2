import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  requestSignContract,
  requestSignInputSchema,
} from "./request-sign.contract.js";
import { requestSignConfirmationSummary } from "./request-sign.js";

const validId = "11111111-1111-4111-8111-111111111111";

const requestSignSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "request-sign.ts"),
  "utf8",
);

describe("documents.requestSign contract", () => {
  it("is a staff client high-risk HITL write with documents:edit", () => {
    expect(requestSignContract.name).toBe("documents.requestSign");
    expect(requestSignContract.principal).toBe("staff");
    expect(requestSignContract.transport).toBe("client");
    expect(requestSignContract.risk).toBe("high");
    expect(requestSignContract.permissions).toEqual(["documents:edit"]);
    expect(requestSignContract.aiExposure).toBe("exposed");
    expect(requestSignContract.requiresConfirmation).toBe(true);
    expect(requestSignContract.idempotent).toBe(true);
    expect(requestSignContract.audit).toBe(true);
    expect(requestSignContract.emits).toEqual(["documents.signRequested"]);
    expect(requestSignContract.atomicCalls).toEqual([]);
    expect(requestSignContract.atomicCallers).toEqual([]);
    expect(requestSignContract.timeout).toBe(5_000);
    expect(requestSignContract.rateLimit).toBeUndefined();
  });

  it("accepts documentId and rejects companyId", () => {
    expect(requestSignInputSchema.parse({ documentId: validId })).toEqual({
      documentId: validId,
    });
    expect(requestSignInputSchema.safeParse({}).success).toBe(false);
    expect(
      requestSignInputSchema.safeParse({ documentId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      requestSignInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });

  it("uses a static confirmation summary without live number or PII", () => {
    expect(requestSignConfirmationSummary).toContain(
      "qualified electronic signature",
    );
    expect(requestSignConfirmationSummary).toContain("key possession");
    expect(requestSignConfirmationSummary).not.toMatch(/\d{6}/);
    expect(requestSignConfirmationSummary).not.toContain("@");
    expect(requestSignConfirmationSummary).not.toContain("+380");
  });

  it("nests getArtifact and getSigning without foreign schema joins", () => {
    expect(requestSignSource).toContain("getArtifact");
    expect(requestSignSource).toContain("@showzy/doc-generation/get-artifact");
    expect(requestSignSource).toContain("getSigning");
    expect(requestSignSource).toContain("@showzy/doc-signing/get");
    expect(requestSignSource).not.toContain('@showzy/doc-signing"');
    expect(requestSignSource).not.toContain("@showzy/db/schema/doc-signing");
    expect(requestSignSource).not.toContain("@showzy/db/schema/doc-generation");
    expect(requestSignSource).not.toContain("documents.sign");
  });
});
