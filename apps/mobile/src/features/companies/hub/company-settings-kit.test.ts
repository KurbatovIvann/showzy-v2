import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("companies hub stays off FormScreenScaffold", () => {
  it("keeps the read-only hub chrome; legal form already uses the kit", () => {
    const hub = readFileSync(
      new URL("./company-settings-view.tsx", import.meta.url),
      "utf8",
    );
    const legal = readFileSync(
      new URL("../form/company-legal-form-view.tsx", import.meta.url),
      "utf8",
    );
    expect(hub).toContain("SafeAreaView");
    expect(hub).toContain('edges={["top"]}');
    expect(hub).toContain("subtitle: model.identity.name");
    expect(hub).toContain("ListSurface");
    expect(hub).toContain("<ListRow first>");
    expect(hub).not.toContain("FormScreenScaffold");
    expect(legal).toContain("FormScreenScaffold");
    expect(legal).not.toContain("SafeAreaView");
  });
});
