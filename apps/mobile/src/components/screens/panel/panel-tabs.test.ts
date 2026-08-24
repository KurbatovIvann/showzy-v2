import { describe, expect, it } from "vitest";

import { isPanelTab, orderedPanelTabs, panelTabOrder } from "./panel-tabs";

describe("panel tabs", () => {
  it("pins the canvas tab order (more lands in ui-shell-T2)", () => {
    expect(panelTabOrder).toEqual(["orders", "products", "ai", "customers"]);
  });

  it("orders registered routes by the canvas, not registration order", () => {
    expect(orderedPanelTabs(["customers", "ai", "orders", "products"])).toEqual(
      ["orders", "products", "ai", "customers"],
    );
  });

  it("drops routes that are not panel tabs", () => {
    expect(orderedPanelTabs(["orders", "session", "ai"])).toEqual([
      "orders",
      "ai",
    ]);
    expect(orderedPanelTabs([])).toEqual([]);
  });

  it("guards tab route names", () => {
    expect(isPanelTab("orders")).toBe(true);
    expect(isPanelTab("ai")).toBe(true);
    expect(isPanelTab("more")).toBe(false);
    expect(isPanelTab("session")).toBe(false);
  });
});
