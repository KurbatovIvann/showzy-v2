import { describe, expect, it } from "vitest";

import { documentsCreateHref, documentsHref } from "./document-hrefs";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("document hrefs", () => {
  it("keeps the list under /documents and does not take companyId", () => {
    expect(documentsHref()).toBe("/documents");
    expect(documentsHref(ORDER_ID)).toBe(`/documents?orderId=${ORDER_ID}`);
    expect(documentsCreateHref()).toBe("/documents/new");
    expect(documentsHref()).not.toContain("companyId");
    expect(documentsHref(ORDER_ID)).not.toContain("companyId");
  });
});
