/**
 * Process entry for `pnpm --filter @showzy/db backup:verify`.
 * The `.mjs` script is a thin argv shim onto this file.
 */
import process from "node:process";

import { defaultBackupVerifyDeps, runBackupVerify } from "./backup-verify.js";

const result = runBackupVerify(
  process.argv.slice(2),
  defaultBackupVerifyDeps(),
);
process.exitCode = result.ok ? 0 : 1;
