import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DOCUMENT_BASIS_MAX } from "./document-view.contract.js";
import {
  createFromOrderContract,
  createFromOrderInputSchema,
} from "./create-from-order.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

const createSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "create-from-order.ts"),
  "utf8",
);

describe("documents.createFromOrder contract", () => {
  it("is a staff client write with documents:create, idempotent audit, and documents.created", () => {
    expect(createFromOrderContract.name).toBe("documents.createFromOrder");
    expect(createFromOrderContract.principal).toBe("staff");
    expect(createFromOrderContract.transport).toBe("client");
    expect(createFromOrderContract.risk).toBe("write");
    expect(createFromOrderContract.permissions).toEqual(["documents:create"]);
    expect(createFromOrderContract.aiExposure).toBe("exposed");
    expect(createFromOrderContract.audit).toBe(true);
    expect(createFromOrderContract.idempotent).toBe(true);
    expect(createFromOrderContract.requiresConfirmation).toBe(false);
    expect(createFromOrderContract.emits).toEqual(["documents.created"]);
    expect(createFromOrderContract.atomicCalls).toEqual([]);
    expect(createFromOrderContract.atomicCallers).toEqual([]);
    expect(createFromOrderContract.timeout).toBe(15_000);
  });

  it("accepts orderId + type, optional counterpartyId/layoutKey/basis, and rejects companyId", () => {
    expect(
      createFromOrderInputSchema.parse({
        orderId: validId,
        type: "payment_invoice",
      }),
    ).toEqual({ orderId: validId, type: "payment_invoice" });
    expect(
      createFromOrderInputSchema.parse({
        orderId: validId,
        type: "delivery_note",
        counterpartyId: validId,
        layoutKey: "delivery_note.parties",
        basis: "  Договір № 1  ",
      }),
    ).toEqual({
      orderId: validId,
      type: "delivery_note",
      counterpartyId: validId,
      layoutKey: "delivery_note.parties",
      basis: "Договір № 1",
    });
    expect(
      createFromOrderInputSchema.safeParse({
        orderId: validId,
        type: "payment_invoice",
        companyId: validId,
      }).success,
    ).toBe(false);
    expect(
      createFromOrderInputSchema.safeParse({
        type: "payment_invoice",
      }).success,
    ).toBe(false);
    expect(
      createFromOrderInputSchema.safeParse({
        orderId: validId,
        type: "agreement",
      }).success,
    ).toBe(false);
    expect(
      createFromOrderInputSchema.safeParse({
        orderId: validId,
        type: "payment_invoice",
        layoutKey: "",
      }).success,
    ).toBe(false);
    expect(
      createFromOrderInputSchema.safeParse({
        orderId: validId,
        type: "payment_invoice",
        basis: "x".repeat(DOCUMENT_BASIS_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      createFromOrderInputSchema.parse({
        orderId: validId,
        type: "payment_invoice",
        basis: "x".repeat(DOCUMENT_BASIS_MAX),
      }).basis,
    ).toBe("x".repeat(DOCUMENT_BASIS_MAX));
  });

  it("nests docGeneration.resolveLayout without importing the generation barrel", () => {
    expect(createSource).toContain("@showzy/doc-generation/resolve-layout");
    expect(createSource).toContain("resolveLayout");
    expect(createSource).toContain("payment_invoice.branded");
    expect(createSource).toContain("delivery_note.parties");
    expect(createSource).not.toMatch(/from "@showzy\/doc-generation";/);
    expect(createSource).not.toContain("listLayouts");
    expect(createSource).not.toContain("ctx.callAtomic");
  });
});
