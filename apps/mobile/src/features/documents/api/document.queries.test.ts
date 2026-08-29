import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  LIST_DOCUMENTS_ACTION,
  listDocumentsInfiniteOptions,
  listDocumentsWireInput,
} from "./document.queries";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("listDocumentsWireInput", () => {
  it("forwards type and optional orderId, and appends the cursor", () => {
    expect(listDocumentsWireInput({ type: "all" }, null)).toEqual({
      type: "all",
    });
    expect(
      listDocumentsWireInput(
        { type: "payment_invoice", orderId: ORDER_ID },
        "2026-08-29T12:00:00.000Z|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ),
    ).toEqual({
      type: "payment_invoice",
      orderId: ORDER_ID,
      cursor: "2026-08-29T12:00:00.000Z|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("omits orderId entirely when the list is not order-scoped", () => {
    expect(listDocumentsWireInput({ type: "all" }, null)).not.toHaveProperty(
      "orderId",
    );
  });
});

describe("listDocumentsInfiniteOptions", () => {
  it("keys [actionName, companyId, input] and keeps cursor out of the key", () => {
    const all = listDocumentsInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: { type: "all" },
      getActiveCompany: () => "company-a",
    });
    const invoices = listDocumentsInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: { type: "payment_invoice" },
      getActiveCompany: () => "company-a",
    });
    const otherCompany = listDocumentsInfiniteOptions({
      client: null,
      companyId: "company-b",
      input: { type: "all" },
      getActiveCompany: () => "company-b",
    });
    const byOrder = listDocumentsInfiniteOptions({
      client: null,
      companyId: "company-a",
      input: { type: "all", orderId: ORDER_ID },
      getActiveCompany: () => "company-a",
    });
    expect(all.queryKey).toEqual(
      contractQueryKey(LIST_DOCUMENTS_ACTION, "company-a", { type: "all" }),
    );
    expect(invoices.queryKey).toEqual(
      contractQueryKey(LIST_DOCUMENTS_ACTION, "company-a", {
        type: "payment_invoice",
      }),
    );
    expect(byOrder.queryKey).toEqual(
      contractQueryKey(LIST_DOCUMENTS_ACTION, "company-a", {
        type: "all",
        orderId: ORDER_ID,
      }),
    );
    expect(all.queryKey).not.toEqual(invoices.queryKey);
    expect(all.queryKey).not.toEqual(otherCompany.queryKey);
    expect(all.queryKey).not.toEqual(byOrder.queryKey);
    expect(all.queryKey[1]).toBe("company-a");
    expect(byOrder.queryKey[1]).toBe("company-a");
    expect(JSON.stringify(byOrder.queryKey)).toContain(ORDER_ID);
    expect(JSON.stringify(all.queryKey)).not.toContain("cursor");
    expect(JSON.stringify(all.queryKey)).not.toContain("companyId");
    expect(all.enabled).toBe(false);
  });
});
