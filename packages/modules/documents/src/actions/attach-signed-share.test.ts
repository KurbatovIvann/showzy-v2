import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ATTACH_SIGNED_SHARE_EVENT_NAME,
  attachSignedShareContract,
  attachSignedShareInputSchema,
} from "./attach-signed-share.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const attachSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "attach-signed-share.ts"),
  "utf8",
);

const envelope = {
  eventId: validId,
  name: ATTACH_SIGNED_SHARE_EVENT_NAME,
  version: 1,
  occurredAt: "2026-08-30T12:00:00.000Z",
  companyId: validId,
  aggregate: { type: "document", id: validId, sequence: "1" },
  actor: { type: "user" as const, id: validId, channel: "ui" as const },
  requestId: validId,
  correlationId: validId,
  causationId: validId,
  payload: {
    documentId: validId,
    signerRole: "supplier" as const,
    fileId: validId,
  },
};

describe("documents.attachSignedShare contract", () => {
  it("is a tenant system internal write, audited, and delivery-idempotent", () => {
    expect(attachSignedShareContract.name).toBe("documents.attachSignedShare");
    expect(attachSignedShareContract.principal).toBe("system");
    expect(attachSignedShareContract.systemScope).toBe("tenant");
    expect(attachSignedShareContract.transport).toBe("internal");
    expect(attachSignedShareContract.risk).toBe("write");
    expect(attachSignedShareContract.permissions).toEqual([]);
    expect(attachSignedShareContract.aiExposure).toBe("internal");
    expect(attachSignedShareContract.audit).toBe(true);
    expect(attachSignedShareContract.idempotent).toBe(true);
    expect(attachSignedShareContract.requiresConfirmation).toBe(false);
    expect(attachSignedShareContract.emits).toEqual([]);
    expect(attachSignedShareContract.atomicCalls).toEqual([]);
    expect(attachSignedShareContract.atomicCallers).toEqual([]);
    expect(attachSignedShareContract.timeout).toBe(10_000);
    expect(ATTACH_SIGNED_SHARE_EVENT_NAME).toBe("docSigning.recorded");
  });

  it("accepts a recorded envelope and does not treat companyId as a grant field", () => {
    expect(attachSignedShareInputSchema.parse(envelope)).toEqual(envelope);
    expect(
      attachSignedShareInputSchema.safeParse({
        ...envelope,
        name: "documents.created",
      }).success,
    ).toBe(false);
    expect(
      attachSignedShareInputSchema.safeParse({
        ...envelope,
        payload: { ...envelope.payload, signerRole: "buyer" },
      }).success,
    ).toBe(false);
  });

  it("nests the system signing issuer only and does not rotate the page token", () => {
    expect(attachSource).toContain("issueSystemSigningDownloadUrl");
    expect(attachSource).not.toContain("issueShareSigningDownloadUrl");
    expect(attachSource).not.toContain("issueShareDownloadUrl");
    expect(attachSource).not.toContain("getDownloadUrl");
    expect(attachSource).not.toContain("revokedAt:");
    expect(attachSource).not.toContain("generateDocumentShareToken");
    expect(attachSource).not.toContain("@showzy/core/testing");
    expect(attachSource).not.toContain("@showzy/db/schema/files");
    expect(attachSource).not.toContain("@showzy/db/schema/doc-signing");
  });
});
