import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SIGN_REQUEST_GRANT_TTL_MS,
  lockIssuedForSigningContract,
  lockIssuedForSigningInputSchema,
} from "./lock-issued-for-signing.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const lockSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "lock-issued-for-signing.ts"),
  "utf8",
);

describe("documents.lockIssuedForSigning contract", () => {
  it("is a staff internal read with documents:edit and a row lock", () => {
    expect(lockIssuedForSigningContract.name).toBe(
      "documents.lockIssuedForSigning",
    );
    expect(lockIssuedForSigningContract.principal).toBe("staff");
    expect(lockIssuedForSigningContract.transport).toBe("internal");
    expect(lockIssuedForSigningContract.risk).toBe("read");
    expect(lockIssuedForSigningContract.permissions).toEqual([
      "documents:edit",
    ]);
    expect(lockIssuedForSigningContract.aiExposure).toBe("internal");
    expect(lockIssuedForSigningContract.audit).toBe(false);
    expect(lockIssuedForSigningContract.idempotent).toBe(false);
    expect(lockIssuedForSigningContract.emits).toEqual([]);
    expect(lockIssuedForSigningContract.atomicCalls).toEqual([]);
    expect(lockIssuedForSigningContract.atomicCallers).toEqual([]);
    expect(lockIssuedForSigningContract.timeout).toBe(5_000);
    expect(SIGN_REQUEST_GRANT_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("accepts documentId and rejects companyId", () => {
    expect(
      lockIssuedForSigningInputSchema.parse({ documentId: validId }),
    ).toEqual({ documentId: validId });
    expect(lockIssuedForSigningInputSchema.safeParse({}).success).toBe(false);
    expect(
      lockIssuedForSigningInputSchema.safeParse({
        documentId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      lockIssuedForSigningInputSchema.safeParse({
        documentId: validId,
        companyId: validId,
      }).success,
    ).toBe(false);
  });

  it("locks the documents row like requestSign/cancel and nests getArtifact", () => {
    expect(lockSource).toContain('.for("update")');
    expect(lockSource).toContain("getArtifact");
    expect(lockSource).toContain("@showzy/doc-generation/get-artifact");
    expect(lockSource).toContain("@showzy/db/schema/documents");
    expect(lockSource).not.toContain("@showzy/db/schema/doc-signing");
    expect(lockSource).not.toContain("@showzy/db/schema/doc-generation");
    expect(lockSource).not.toMatch(/\bdocuments\.sign\b/);
    expect(lockSource).not.toContain("ctx.callAtomic");
  });
});
