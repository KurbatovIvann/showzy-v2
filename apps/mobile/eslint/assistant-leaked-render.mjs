/**
 * `react/jsx-no-leaked-render` is not in the workspace ESLint plugins.
 * Assistant TSX must not use `{value && <Component />}` — falsy `0` / `""`
 * crash React Native (vercel-react-native-skills).
 */
export const assistantJsxNoLeakedRender = {
  selector: "JSXExpressionContainer > LogicalExpression[operator='&&']",
  message:
    "Do not use && in JSX (react/jsx-no-leaked-render). Use a ternary with null.",
};
