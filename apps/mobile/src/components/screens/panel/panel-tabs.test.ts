import { describe, expect, it } from "vitest";

import { isPanelTab, orderedPanelTabs, panelTabOrder } from "./panel-tabs";

describe("panel tabs", () => {
  it("pins the canvas tab order", () => {
    expect(panelTabOrder).toEqual([
      "orders",
      "products",
      "ai",
      "customers",
      "more",
    ]);
  });

  it("orders registered routes by the canvas, not registration order", () => {
    expect(
      orderedPanelTabs(["more", "customers", "ai", "orders", "products"]),
    ).toEqual(["orders", "products", "ai", "customers", "more"]);
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
    expect(isPanelTab("more")).toBe(true);
    expect(isPanelTab("session")).toBe(false);
  });
});
