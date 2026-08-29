import { describe, expect, it } from "vitest";

import {
  LIST_DOCUMENTS_CURSOR_MAX,
  LIST_DOCUMENTS_DEFAULT_LIMIT,
  LIST_DOCUMENTS_MAX_LIMIT,
  formatListDocumentsCursor,
  listDocumentsContract,
  listDocumentsInputSchema,
  parseListDocumentsCursor,
} from "./list.contract.js";

const validId = "11111111-1111-4111-8111-111111111111";

describe("documents.list contract", () => {
  it("is a staff client read with documents:view", () => {
    expect(listDocumentsContract.name).toBe("documents.list");
    expect(listDocumentsContract.principal).toBe("staff");
    expect(listDocumentsContract.transport).toBe("client");
    expect(listDocumentsContract.risk).toBe("read");
    expect(listDocumentsContract.permissions).toEqual(["documents:view"]);
    expect(listDocumentsContract.aiExposure).toBe("exposed");
    expect(listDocumentsContract.audit).toBe(false);
    expect(listDocumentsContract.idempotent).toBe(false);
    expect(listDocumentsContract.emits).toEqual([]);
    expect(listDocumentsContract.atomicCalls).toEqual([]);
    expect(listDocumentsContract.atomicCallers).toEqual([]);
    expect(listDocumentsContract.timeout).toBe(5_000);
    expect(listDocumentsContract.rateLimit).toBeUndefined();
    expect(LIST_DOCUMENTS_DEFAULT_LIMIT).toBe(20);
    expect(LIST_DOCUMENTS_MAX_LIMIT).toBe(50);
    expect(LIST_DOCUMENTS_CURSOR_MAX).toBe(80);
  });

  it("defaults type to all and rejects a malformed cursor, oversized limit, and companyId", () => {
    expect(listDocumentsContract.input.parse({}).type).toBe("all");
    expect(listDocumentsContract.input.parse({}).limit).toBe(
      LIST_DOCUMENTS_DEFAULT_LIMIT,
    );
    expect(
      listDocumentsContract.input.safeParse({ cursor: "nope" }).success,
    ).toBe(false);
    expect(
      listDocumentsContract.input.safeParse({
        limit: LIST_DOCUMENTS_MAX_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(listDocumentsContract.input.safeParse({ limit: 0 }).success).toBe(
      false,
    );
    expect(
      listDocumentsContract.input.safeParse({ type: "agreement" }).success,
    ).toBe(false);
    expect(
      listDocumentsContract.input.safeParse({ orderId: "not-a-uuid" }).success,
    ).toBe(false);
    expect(Object.keys(listDocumentsInputSchema.shape).toSorted()).toEqual([
      "cursor",
      "limit",
      "orderId",
      "type",
    ]);
    expect(
      listDocumentsInputSchema.safeParse({ companyId: validId }).success,
    ).toBe(false);
    expect(
      listDocumentsInputSchema.safeParse({
        type: "all",
        companyId: validId,
      }).success,
    ).toBe(false);
    expect(
      listDocumentsInputSchema.safeParse({ search: "invoice" }).success,
    ).toBe(false);
    expect(parseListDocumentsCursor("nope")).toBeUndefined();
    expect(
      parseListDocumentsCursor(
        formatListDocumentsCursor(new Date("2026-01-01T00:00:00.000Z"), "nope"),
      ),
    ).toBeUndefined();
  });

  it("round-trips a createdAt/id cursor", () => {
    const createdAt = new Date("2026-03-01T00:00:00.000Z");
    const cursor = formatListDocumentsCursor(createdAt, validId);
    expect(parseListDocumentsCursor(cursor)).toEqual({
      createdAt: "2026-03-01T00:00:00.000Z",
      id: validId,
    });
  });
});
