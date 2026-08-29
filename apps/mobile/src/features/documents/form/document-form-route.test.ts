import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const FORM_DIR = dirname(fileURLToPath(import.meta.url));

function formSources(): string {
  return readdirSync(FORM_DIR)
    .filter(
      (name) =>
        (name.endsWith(".ts") || name.endsWith(".tsx")) &&
        !name.endsWith(".test.ts") &&
        !name.endsWith(".test.tsx"),
    )
    .map((name) => readFileSync(join(FORM_DIR, name), "utf8"))
    .join("\n");
}

describe("documents/new and /d/[token] routes", () => {
  it("is the create screen at /documents/new", () => {
    expect(CREATE_ROUTE).toContain("export { DocumentFormScreen as default }");
    expect(CREATE_ROUTE).toContain(
      "features/documents/form/document-form-screen",
    );
    expect(CREATE_SCREEN).toContain("export function DocumentFormScreen");
    expect(CREATE_HOOK).toContain("documents.createFromOrder");
    expect(CREATE_VIEW).toContain("DocumentTypeCards");
    expect(CREATE_VIEW).not.toContain("ChoiceField");
  });

  it("keeps the public token route outside (app) and does not send companyId", () => {
    expect(SHARED_ROUTE).toContain(
      "export { DocumentSharedScreen as default }",
    );
    expect(SHARED_ROUTE).toContain(
      "features/documents/share/document-shared-screen",
    );
    expect(SHARED_ROUTE).not.toContain("(app)");
    expect(SHARED_HOOK).toContain("documents.getShared");
    expect(SHARED_HOOK).toContain("shareTokenFromParam");
    expect(SHARED_HOOK).not.toContain("companyId");
    expect(SHARED_HOOK).not.toContain("useActiveCompany");
  });

  it("does not import list, orders, or customers feature folders", () => {
    const sources = formSources();
    expect(sources).not.toContain("../list/");
    expect(sources).not.toContain("features/orders");
    expect(sources).not.toContain("features/customers");
    expect(CREATE_VIEW).not.toContain("date-fns");
    expect(CREATE_HOOK).not.toContain("date-fns");
  });
});
