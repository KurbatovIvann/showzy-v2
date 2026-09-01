import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("documents form adopts form-kit", () => {
  it("uses shared save, guard, and scaffold; no local guard or text-field copies", () => {
    const hook = read("./use-document-form.ts");
    const save = read("./use-document-save.ts");
    const saveLoop = read("./document-form-save.ts");
    const view = read("./document-form-view.tsx");
    const fields = read("./document-form-fields.tsx");
    const leave = read("./document-form-leave.ts");

    expect(hook).toContain("useUnsavedGuard");
    expect(hook).toContain('armedLeave: "dispatch-only"');
    expect(hook).toContain("presentDocumentFormView");
    expect(hook).not.toContain("useUnsavedDocumentGuard");
    expect(save).toContain("useFormSave");
    expect(save).toContain("bindDocumentFormMutate");
    expect(saveLoop).toContain("runFormSave");
    expect(view).toContain("FormScreenScaffold");
    expect(view).not.toContain("SafeAreaView");
    expect(fields).not.toContain("<Controller");
    expect(fields).not.toContain("FormTextField");
    expect(leave).toContain("resolveArmedFormLeave");
    expect(leave).toContain('mode: "dispatch-only"');
  });
});
