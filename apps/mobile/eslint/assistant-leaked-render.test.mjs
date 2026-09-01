import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint, Linter } from "eslint";
import { describe, expect, it } from "vitest";

import {
  assistantJsxNoLeakedRender,
  assistantRestrictedSyntax,
} from "./assistant-leaked-render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const toolingRequire = createRequire(
  join(here, "../../../packages/tooling/package.json"),
);
const tseslint = toolingRequire("typescript-eslint");

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
      "no-restricted-syntax": ["error", ...assistantRestrictedSyntax],
    },
  });
}

/**
 * @param {string} code
 */
function lintAssistantTsx(code) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(code, {
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-restricted-syntax": ["error", ...assistantRestrictedSyntax],
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

  it("still rejects as unknown as in assistant TSX", () => {
    const messages = lintAssistantTsx(
      `export function Row(props: { n: number }) { const x = props as unknown as { n: string }; return <View>{x.n ? <Text>{x.n}</Text> : null}</View>; }`,
    );
    const restricted = messages.filter(
      (message) => message.ruleId === "no-restricted-syntax",
    );
    expect(restricted.length).toBeGreaterThanOrEqual(1);
    expect(
      restricted.some((message) =>
        message.message.includes("Double assertions"),
      ),
    ).toBe(true);
  });
});

describe("assistantRestrictedSyntax", () => {
  it("keeps both the double-assertion ban and leaked-render selector", () => {
    expect(assistantRestrictedSyntax).toHaveLength(2);
    expect(assistantRestrictedSyntax[0]?.selector).toBe(
      "TSAsExpression > TSAsExpression",
    );
    expect(assistantRestrictedSyntax[1]).toEqual(assistantJsxNoLeakedRender);
  });

  it("wires both selectors into the assistant TSX ESLint override", async () => {
    const eslint = new ESLint({ cwd: join(here, "..") });
    const config = await eslint.calculateConfigForFile(
      join(here, "../src/features/assistant/sheet/confirmation-card.tsx"),
    );
    const rule = config.rules["no-restricted-syntax"];
    expect(Array.isArray(rule)).toBe(true);
    const selectors = Array.isArray(rule)
      ? rule
          .slice(1)
          .map((entry) =>
            typeof entry === "object" && entry !== null && "selector" in entry
              ? entry.selector
              : null,
          )
      : [];
    expect(selectors).toContain("TSAsExpression > TSAsExpression");
    expect(selectors).toContain(
      "JSXExpressionContainer > LogicalExpression[operator='&&']",
    );
  });
});
