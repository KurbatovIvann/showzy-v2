import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("companies form adopts form-kit", () => {
  it("uses shared save, guard, scaffold, and text field", () => {
    const hook = readFileSync(
      new URL("./use-company-legal-form.ts", import.meta.url),
      "utf8",
    );
    const view = readFileSync(
      new URL("./company-legal-form-view.tsx", import.meta.url),
      "utf8",
    );
    const fields = readFileSync(
      new URL("./company-legal-form-fields.tsx", import.meta.url),
      "utf8",
    );
    expect(hook).toContain("useFormSave");
    expect(hook).toContain("useUnsavedGuard");
    expect(hook).toContain("bindCompanyLegalFormMutate");
    expect(hook).not.toContain("useCompanyLegalSave");
    expect(hook).not.toContain("useUnsavedCompanyLegalGuard");
    expect(view).toContain("FormScreenScaffold");
    expect(view).not.toContain("SafeAreaView");
    expect(fields).toContain("FormTextField");
    expect(fields).not.toContain("<Controller");
  });
});
