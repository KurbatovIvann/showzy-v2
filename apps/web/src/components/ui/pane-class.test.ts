import { describe, expect, it } from "vitest";

import { detailPaneClass, listPaneClass } from "./pane-class";

describe("pane classes (SHO-314)", () => {
  it("gives the list pane flex-1 so a phone list-only row can fill", () => {
    expect(listPaneClass()).toContain("flex-1");
    expect(listPaneClass()).toContain("pane-list");
    expect(listPaneClass()).not.toContain("pane-hide-narrow");
  });

  it("keeps the detail pane growing and does not use a dead hide class", () => {
    expect(detailPaneClass()).toContain("flex-1");
    expect(detailPaneClass()).toContain("pane-detail");
    expect(detailPaneClass()).not.toContain("pane-hide-narrow");
  });
});
