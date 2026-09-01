/**
 * `react/jsx-no-leaked-render` is not in the workspace ESLint plugins.
 * Assistant TSX must not use `{value && <Component />}` — falsy `0` / `""`
 * crash React Native (vercel-react-native-skills).
 *
 * Flat ESLint replaces `no-restricted-syntax` options instead of merging
 * them, so this override must keep the workspace `as unknown as` ban too
 * (packages/tooling/eslint/base.mjs / prohibitions.mdc).
 */
export const doubleAssertionBan = {
  selector: "TSAsExpression > TSAsExpression",
  message:
    "Double assertions (`as unknown as`) are prohibited. Fix the types instead.",
};

export const assistantJsxNoLeakedRender = {
  selector: "JSXExpressionContainer > LogicalExpression[operator='&&']",
  message:
    "Do not use && in JSX (react/jsx-no-leaked-render). Use a ternary with null.",
};

export const assistantRestrictedSyntax = [
  doubleAssertionBan,
  assistantJsxNoLeakedRender,
];
