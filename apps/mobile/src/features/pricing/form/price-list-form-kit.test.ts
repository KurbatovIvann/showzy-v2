import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("price-list form adopts form-kit", () => {
  it("uses shared guard, scaffold, and text field; keeps the multi-write save loop", () => {
    const hook = readFileSync(
      new URL("./use-price-list-form.ts", import.meta.url),
      "utf8",
    );
    const save = readFileSync(
      new URL("./use-price-list-save.ts", import.meta.url),
      "utf8",
    );
    const view = readFileSync(
      new URL("./price-list-form-view.tsx", import.meta.url),
      "utf8",
    );
    const fields = readFileSync(
      new URL("./price-list-form-fields.tsx", import.meta.url),
      "utf8",
    );
    expect(hook).toContain("useUnsavedGuard");
    expect(hook).toContain("usePriceListSave");
    expect(hook).toContain("usePriceListFormQueries");
    expect(hook).toContain("useVariantExpansion");
    expect(hook).toContain("usePriceListFormDirty");
    expect(hook).not.toContain("useUnsavedPriceListGuard");
    expect(hook).not.toContain("setDraft:");
    expect(save).toContain("useBoundContractMutation");
    expect(save).toContain("runPriceListFormSave");
    expect(save).not.toContain("setDraft");
    expect(view).toContain("FormScreenScaffold");
    expect(view).toContain("FlashList");
    expect(view).not.toContain("SafeAreaView");
    expect(fields).toContain("FormTextField");
    expect(fields).not.toContain("<Controller");
  });
});
