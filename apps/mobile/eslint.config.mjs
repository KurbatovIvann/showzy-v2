import { showzyEslintConfig } from "@showzy/tooling/eslint";

import { assistantTsxOverride } from "./eslint/assistant-leaked-render.mjs";
import { customersBoundaryConfigs } from "./eslint/customers-boundaries.mjs";

export default [
  ...showzyEslintConfig({ tsconfigRootDir: import.meta.dirname }),
  ...customersBoundaryConfigs,
  assistantTsxOverride,
];
