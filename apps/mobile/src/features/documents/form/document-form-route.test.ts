import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Vitest is node-only (no RN), so this pins the route module source
 * instead of mounting screens.
 */
const CREATE_ROUTE = readFileSync(
  new URL("../../../app/(app)/documents/new.tsx", import.meta.url),
  "utf8",
);
const CREATE_SCREEN = readFileSync(
  new URL("./document-form-screen.tsx", import.meta.url),
  "utf8",
);
const CREATE_HOOK = readFileSync(
  new URL("./use-document-form.ts", import.meta.url),
  "utf8",
);
const CREATE_SAVE = readFileSync(
  new URL("./use-document-save.ts", import.meta.url),
  "utf8",
);
const CREATE_HANDOVER = readFileSync(
  new URL("./document-form-handover.ts", import.meta.url),
  "utf8",
);
const CREATE_HANDOVER_HOOK = readFileSync(
  new URL("./use-document-form-handover.ts", import.meta.url),
  "utf8",
);
const CREATE_PLAN = readFileSync(
  new URL("./document-form-plan.ts", import.meta.url),
  "utf8",
);
const CREATE_VIEW = readFileSync(
  new URL("./document-form-view.tsx", import.meta.url),
  "utf8",
);
const SHARED_ROUTE = readFileSync(
  new URL("../../../app/d/[token].tsx", import.meta.url),
  "utf8",
);
const SHARED_HOOK = readFileSync(
  new URL("../share/use-document-shared.ts", import.meta.url),
  "utf8",
);
const SHARED_QUERY = readFileSync(
  new URL("../api/document-shared-query.ts", import.meta.url),
  "utf8",
);

const FORM_IMPL_FILES = [
  "document-form-copy.ts",
  "document-form-draft.ts",
  "document-form-fields.tsx",
  "document-form-handover.ts",
  "document-form-leave.ts",
  "document-form-load.ts",
  "document-form-pickers.ts",
  "document-form-plan.ts",
  "document-form-save.ts",
  "document-form-screen.tsx",
  "document-form-view.tsx",
  "document-form.schema.ts",
  "editor-section.tsx",
  "use-document-form-handover.ts",
  "use-document-form-lookups.ts",
  "use-document-form-pickers.ts",
  "use-document-form.ts",
  "use-document-save.ts",
  "use-unsaved-document-guard.ts",
] as const;

function formSources(): string {
  return FORM_IMPL_FILES.map((name) =>
    readFileSync(new URL(`./${name}`, import.meta.url), "utf8"),
  ).join("\n");
}

describe("documents/new and /d/[token] routes", () => {
  it("is the create screen at /documents/new", () => {
    expect(CREATE_ROUTE).toContain("export { DocumentFormScreen as default }");
    expect(CREATE_ROUTE).toContain(
      "features/documents/form/document-form-screen",
    );
    expect(CREATE_SCREEN).toContain("export function DocumentFormScreen");
    expect(CREATE_PLAN).toContain("documents.createFromOrder");
    expect(CREATE_SAVE).toContain("bindDocumentFormMutate");
    expect(CREATE_HOOK).toContain("useDocumentSave");
    expect(CREATE_HOOK).toContain("useDocumentFormHandover");
    expect(
      CREATE_HOOK.slice(CREATE_HOOK.indexOf("\n  return {")),
    ).not.toContain("control");
    expect(CREATE_VIEW).not.toContain("model.control");
    expect(CREATE_HANDOVER).toContain("waitThenReplaceAfterCreateHandover");
    expect(CREATE_HANDOVER).not.toContain("handoverChrome.visible");
    expect(CREATE_HANDOVER_HOOK).toContain("useSheetHiddenWaiter");
    expect(CREATE_HANDOVER_HOOK).toContain(
      "waitThenReplaceAfterCreateHandover",
    );
    expect(CREATE_HANDOVER_HOOK).toContain("isSafeHttpUrl");
    expect(CREATE_HANDOVER_HOOK).not.toContain(
      "created && !handoverChrome.visible",
    );
    expect(CREATE_VIEW).toContain("DocumentTypeCards");
    expect(CREATE_VIEW).not.toContain("ChoiceField");
    expect(CREATE_VIEW).toContain("OptionSelectSheet");
    expect(CREATE_VIEW).toContain("SelectorRow");
    expect(CREATE_VIEW).toContain('from "../../../components/ui"');
    expect(CREATE_VIEW).not.toContain("./option-select-sheet");
    expect(CREATE_VIEW).not.toContain("./selector-row");
  });

  it("keeps the public token route outside (app) and does not send companyId", () => {
    expect(SHARED_ROUTE).toContain(
      "export { DocumentSharedScreen as default }",
    );
    expect(SHARED_ROUTE).toContain(
      "features/documents/share/document-shared-screen",
    );
    expect(SHARED_ROUTE).not.toContain("(app)");
    expect(SHARED_QUERY).toContain("documents.getShared");
    expect(SHARED_HOOK).toContain("shareTokenFromParam");
    expect(SHARED_HOOK).toContain("getSharedDocumentQueryOptions");
    expect(SHARED_HOOK).not.toContain("companyId");
    expect(SHARED_HOOK).not.toContain("useActiveCompany");
    expect(SHARED_QUERY).toContain("companyId: null");
    expect(SHARED_QUERY).toContain("getActiveCompany: () => null");
  });

  it("does not import list, orders, or customers feature folders", () => {
    const sources = formSources();
    expect(sources).not.toContain("../list/");
    expect(sources).not.toContain("features/orders");
    expect(sources).not.toContain("features/customers");
    expect(sources).toContain("waitThenReplaceAfterCreateHandover");
    expect(sources).not.toContain("created && !handoverChrome.visible");
    expect(CREATE_VIEW).not.toContain("date-fns");
    expect(CREATE_HOOK).not.toContain("date-fns");
  });
});
