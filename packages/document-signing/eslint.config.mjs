import { showzyEslintConfig } from "@showzy/tooling/eslint";

export default [
  {
    ignores: [
      "cpp/**",
      "wasm/**",
      "nitrogen/**",
      "android/**",
      "ios/**",
      "cpp-bridge/**",
      "scripts/**",
      "react-native.config.js",
      "vitest.config.ts",
      "src/platform/worker/uapki-worker.ts",
    ],
  },
  ...showzyEslintConfig({ tsconfigRootDir: import.meta.dirname }),
];
