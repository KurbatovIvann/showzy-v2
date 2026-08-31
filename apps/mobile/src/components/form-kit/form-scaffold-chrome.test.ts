import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  formScaffoldBody,
  formScaffoldShowsFooter,
  formScaffoldShowsRetry,
  type FormScaffoldLoadKind,
} from "./form-scaffold-chrome";

const KINDS: readonly FormScaffoldLoadKind[] = [
  "loading",
  "offline",
  "error",
  "permission",
  "not-found",
  "ready",
];

describe("formScaffoldBody", () => {
  it("maps each load kind to a body slot", () => {
    expect(formScaffoldBody("loading")).toBe("skeleton");
    expect(formScaffoldBody("offline")).toBe("offline");
    expect(formScaffoldBody("error")).toBe("error");
    expect(formScaffoldBody("permission")).toBe("permission");
    expect(formScaffoldBody("not-found")).toBe("not-found");
    expect(formScaffoldBody("ready")).toBe("ready");
  });
});

describe("formScaffoldShowsFooter", () => {
  it("shows the footer only on a ready form that provided one", () => {
    expect(
      formScaffoldShowsFooter({ loadKind: "ready", hasFooter: true }),
    ).toBe(true);
    expect(
      formScaffoldShowsFooter({ loadKind: "ready", hasFooter: false }),
    ).toBe(false);
    for (const loadKind of KINDS) {
      if (loadKind === "ready") {
        continue;
      }
      expect(formScaffoldShowsFooter({ loadKind, hasFooter: true })).toBe(
        false,
      );
    }
  });
});

describe("formScaffoldShowsRetry", () => {
  it("offers retry on offline and error, not permission, not-found, or ready", () => {
    expect(formScaffoldShowsRetry("offline")).toBe(true);
    expect(formScaffoldShowsRetry("error")).toBe(true);
    expect(formScaffoldShowsRetry("permission")).toBe(false);
    expect(formScaffoldShowsRetry("not-found")).toBe(false);
    expect(formScaffoldShowsRetry("loading")).toBe(false);
    expect(formScaffoldShowsRetry("ready")).toBe(false);
  });
});

describe("FormScreenScaffold", () => {
  it("delegates chrome decisions to the pure helpers", () => {
    const source = readFileSync(
      new URL("./form-screen-scaffold.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("formScaffoldBody(");
    expect(source).toContain("formScaffoldShowsFooter(");
    expect(source).toContain("formScaffoldShowsRetry(");
    expect(source).toContain("AppHeader");
    expect(source).toContain("EmptyState");
    expect(source).toContain('case "not-found"');
    expect(source).toContain("notFoundTitle");
    expect(source).toContain("notFoundDescription");
    expect(source).toContain("notFoundIcon");
    expect(source).toContain("footerLeading");
    expect(source).toContain("{footer.footerLeading}");
  });
});
