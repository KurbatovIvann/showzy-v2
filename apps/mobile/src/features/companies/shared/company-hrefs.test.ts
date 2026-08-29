import { describe, expect, it } from "vitest";

import { companyLegalHref, companySettingsHref } from "./company-hrefs";

describe("company settings hrefs", () => {
  it("keeps the hub and legal stub under /more/company", () => {
    expect(companySettingsHref()).toBe("/more/company");
    expect(companyLegalHref()).toBe("/more/company/legal");
  });
});
