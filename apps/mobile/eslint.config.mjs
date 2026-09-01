import { showzyEslintConfig } from "@showzy/tooling/eslint";

import { assistantRestrictedSyntax } from "./eslint/assistant-leaked-render.mjs";
import { customersBoundaryConfigs } from "./eslint/customers-boundaries.mjs";

export default [
  ...showzyEslintConfig({ tsconfigRootDir: import.meta.dirname }),
  ...customersBoundaryConfigs,
  {
    files: ["src/features/assistant/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...assistantRestrictedSyntax],
    },
  },
];
