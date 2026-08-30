import { describe, expect, it } from "vitest";

import { moreRowState } from "./more-rows.presenter";

describe("more row affordances", () => {
  it("shows the company settings row for owner and admin", () => {
    expect(moreRowState("owner").showCompanySettings).toBe(true);
    expect(moreRowState("admin").showCompanySettings).toBe(true);
  });

  it("is not a working company-settings path for manager or employee", () => {
    expect(moreRowState("manager").showCompanySettings).toBe(false);
    expect(moreRowState("employee").showCompanySettings).toBe(false);
  });

  it("enables the documents row for every staff role with documents:view", () => {
    expect(moreRowState("owner").documentsEnabled).toBe(true);
    expect(moreRowState("admin").documentsEnabled).toBe(true);
    expect(moreRowState("manager").documentsEnabled).toBe(true);
    expect(moreRowState("employee").documentsEnabled).toBe(true);
  });
});
