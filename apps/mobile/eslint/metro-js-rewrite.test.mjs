import { describe, expect, it } from "vitest";

import {
  rewriteJsSpecifierToTs,
  shouldRewriteNodeNextJsSpecifier,
} from "../metro-js-rewrite.cjs";

describe("metro NodeNext .js → .ts rewrite (SHO-297)", () => {
  it("rewrites @showzy/ specifiers and origin modules under those packages", () => {
    expect(
      shouldRewriteNodeNextJsSpecifier(
        "@showzy/contract/client.js",
        "/workspace/apps/mobile/src/api/client.ts",
      ),
    ).toBe(true);
    expect(
      shouldRewriteNodeNextJsSpecifier(
        "./modules.js",
        "/workspace/packages/contract/src/client/index.ts",
      ),
    ).toBe(true);
    expect(
      shouldRewriteNodeNextJsSpecifier(
        "./foo.js",
        "/workspace/node_modules/@showzy/validation/src/index.ts",
      ),
    ).toBe(true);
  });

  it("does not rewrite unrelated .js misses", () => {
    expect(
      shouldRewriteNodeNextJsSpecifier(
        "react-native/Libraries/foo.js",
        "/workspace/apps/mobile/src/app/_layout.tsx",
      ),
    ).toBe(false);
    expect(
      shouldRewriteNodeNextJsSpecifier(
        "./vendor.js",
        "/workspace/apps/mobile/src/index.ts",
      ),
    ).toBe(false);
    expect(shouldRewriteNodeNextJsSpecifier("lodash", undefined)).toBe(false);
  });

  it("maps the .js specifier to .ts", () => {
    expect(rewriteJsSpecifierToTs("./modules.js")).toBe("./modules.ts");
  });
});
