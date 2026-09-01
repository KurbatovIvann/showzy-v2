import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { assistantJsxNoLeakedRender } from "./assistant-leaked-render.mjs";

/**
 * @param {string} code
 */
function lintJsx(code) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(code, {
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-restricted-syntax": ["error", assistantJsxNoLeakedRender],
    },
  });
}

describe("assistant jsx-no-leaked-render", () => {
  it("rejects leaked falsy && renders", () => {
    const messages = lintJsx(
      `export function Row({ count }) { return <View>{count && <Text>{count}</Text>}</View>; }`,
    );
    expect(
      messages.filter((message) => message.ruleId === "no-restricted-syntax"),
    ).toHaveLength(1);
  });

  it("allows an explicit ternary with null", () => {
    const messages = lintJsx(
      `export function Row({ count }) { return <View>{count ? <Text>{count}</Text> : null}</View>; }`,
    );
    expect(
      messages.filter((message) => message.ruleId === "no-restricted-syntax"),
    ).toHaveLength(0);
  });
});
