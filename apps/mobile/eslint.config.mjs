import { showzyEslintConfig } from "@showzy/tooling/eslint";

import { customersBoundaryConfigs } from "./eslint/customers-boundaries.mjs";

export default [
  ...showzyEslintConfig({ tsconfigRootDir: import.meta.dirname }),
  ...customersBoundaryConfigs,
];
