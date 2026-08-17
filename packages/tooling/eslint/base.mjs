import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

/**
 * Architectural element types for eslint-plugin-boundaries, derived from
 * blueprint §5. Declared centrally so every package lints against the same
 * map. The allowed-dependency matrix (`boundaries/element-types` rules) is
 * intentionally NOT enabled yet: it is finalized in fnd-T25 once the real
 * packages exist (contract/db/core/modules import rules per ADR-0014/0016).
 */
const boundaryElements = [
  { type: "app", pattern: "apps/*", capture: ["app"] },
  { type: "core", pattern: "packages/core" },
  { type: "db", pattern: "packages/db" },
  { type: "contract", pattern: "packages/contract" },
  { type: "module", pattern: "packages/modules/*", capture: ["module"] },
  { type: "money", pattern: "packages/money" },
  { type: "config", pattern: "packages/config" },
  { type: "validation", pattern: "packages/validation" },
  { type: "tooling", pattern: "packages/tooling" },
];

/**
 * Shared ESLint flat preset (strict, type-checked).
 *
 * @param {object} options
 * @param {string} options.tsconfigRootDir - Pass `import.meta.dirname` from
 *   the consuming package's `eslint.config.mjs` so typed linting resolves the
 *   right tsconfig.
 * @returns {import("typescript-eslint").ConfigArray}
 */
export function showzyEslintConfig({ tsconfigRootDir }) {
  return tseslint.config(
    {
      ignores: ["dist/**", "coverage/**", "node_modules/**", ".turbo/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: { boundaries },
      settings: {
        "boundaries/elements": boundaryElements,
        "boundaries/root-path": tsconfigRootDir,
      },
      rules: {
        // Prohibitions (.cursor/rules/prohibitions.mdc): no `any`,
        // no suppression comments without a linked issue.
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/ban-ts-comment": [
          "error",
          {
            "ts-ignore": true,
            "ts-nocheck": true,
            // `@ts-expect-error` only with a linked issue, e.g.
            // "@ts-expect-error SHO-123: drizzle inference gap".
            "ts-expect-error": { descriptionFormat: "^ SHO-\\d+: .+$" },
          },
        ],
        // No `x as unknown as Y` escape hatch (prohibitions.mdc).
        "no-restricted-syntax": [
          "error",
          {
            selector: "TSAsExpression > TSAsExpression",
            message:
              "Double assertions (`as unknown as`) are prohibited. Fix the types instead.",
          },
        ],
        // Typed error classes only (conventions.mdc); allowing only classes
        // that extend Error still permits `packages/core/errors` subclasses.
        "@typescript-eslint/only-throw-error": "error",
      },
    },
    {
      // Config and script files (.mjs) are not covered by a tsconfig project;
      // typed rules cannot run on them.
      files: ["**/*.mjs", "**/*.js"],
      extends: [tseslint.configs.disableTypeChecked],
    },
    // Keep last: disables formatting rules that would conflict with Prettier.
    prettierConfig,
  );
}
