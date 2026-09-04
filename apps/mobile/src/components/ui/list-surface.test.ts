import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const surface = readFileSync(
  new URL("./list-surface.tsx", import.meta.url),
  "utf8",
);
const chrome = readFileSync(
  new URL("./list-row-chrome.ts", import.meta.url),
  "utf8",
);
const barrel = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("ListSurface grouped chrome", () => {
  it("applies T1 shadows.sm to the wrapping surface and every groupEdge", () => {
    expect(surface).toContain("...theme.shadows.sm");
    expect((surface.match(/\.\.\.theme\.shadows\.sm/g) ?? []).length).toBe(5);
  });

  it("keeps listGroupEdge off the public ui barrel", () => {
    expect(barrel).not.toContain("listGroupEdge");
    expect(chrome).toContain("export function listGroupEdge");
  });
});
