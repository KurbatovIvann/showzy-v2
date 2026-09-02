import { describe, expect, it } from "vitest";

import { contractQueryKey } from "../../../api/query-options";
import {
  LIST_LAYOUTS_ACTION,
  listDocumentLayoutsQueryOptions,
} from "./document-layouts-query";

describe("listDocumentLayoutsQueryOptions", () => {
  it("keys [actionName, companyId, input] including the type filter", () => {
    const options = listDocumentLayoutsQueryOptions({
      client: null,
      companyId: "company-a",
      type: "payment_invoice",
      getActiveCompany: () => "company-a",
    });
    const otherType = listDocumentLayoutsQueryOptions({
      client: null,
      companyId: "company-a",
      type: "delivery_note",
      getActiveCompany: () => "company-a",
    });
    const otherCompany = listDocumentLayoutsQueryOptions({
      client: null,
      companyId: "company-b",
      type: "payment_invoice",
      getActiveCompany: () => "company-b",
    });
    expect(options.queryKey).toEqual(
      contractQueryKey(LIST_LAYOUTS_ACTION, "company-a", {
        type: "payment_invoice",
      }),
    );
    expect(options.queryKey[0]).toBe("docGeneration.listLayouts");
    expect(options.queryKey[1]).toBe("company-a");
    expect(options.queryKey).not.toEqual(otherType.queryKey);
    expect(options.queryKey).not.toEqual(otherCompany.queryKey);
    expect(JSON.stringify(options.queryKey)).not.toContain("companyId");
  });

  it("stays disabled without a client, company, or create-screen enable", () => {
    expect(
      listDocumentLayoutsQueryOptions({
        client: null,
        companyId: "company-a",
        type: "payment_invoice",
        getActiveCompany: () => "company-a",
      }).enabled,
    ).toBe(false);
    expect(
      listDocumentLayoutsQueryOptions({
        client: null,
        companyId: null,
        type: "payment_invoice",
        getActiveCompany: () => null,
        enabled: true,
      }).enabled,
    ).toBe(false);
    expect(
      listDocumentLayoutsQueryOptions({
        client: null,
        companyId: "company-a",
        type: "payment_invoice",
        getActiveCompany: () => "company-a",
        enabled: false,
      }).enabled,
    ).toBe(false);
  });
});
