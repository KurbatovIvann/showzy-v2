/**
 * Generate the committed OpenAPI artifact by bundling the TypeScript writer
 * with esbuild. Workspace packages and `@orpc/*` are inlined — Node cannot
 * resolve those packages from the temp outfile directory.
 */
import { spawnSync } from "node:child_process";
import * as esbuild from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const outfileJson = path.join(packageRoot, "openapi.json");

const tmp = await mkdtemp(path.join(tmpdir(), "showzy-openapi-"));
const bundled = path.join(tmp, "write.mjs");

try {
  await esbuild.build({
    absWorkingDir: packageRoot,
    entryPoints: [path.join(packageRoot, "src/openapi/write.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundled,
  });
  const result = spawnSync(process.execPath, [bundled, outfileJson], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  if (result.stdout !== null && result.stdout !== "") {
    process.stdout.write(result.stdout);
  }
  if (result.stderr !== null && result.stderr !== "") {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
