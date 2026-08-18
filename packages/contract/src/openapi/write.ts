/**
 * Writes `packages/contract/openapi.json`. Bundled by scripts/write-openapi.mjs
 * so the CLI does not need a TypeScript loader.
 */
import { writeFile } from "node:fs/promises";
import process from "node:process";

import { generateOpenApiDocument, renderOpenApiJson } from "./generate.js";

const out = process.argv[2];
if (out === undefined || out === "") {
  process.stderr.write("usage: write.ts <openapi.json path>\n");
  process.exitCode = 2;
} else {
  await writeFile(out, renderOpenApiJson(await generateOpenApiDocument()));
}
