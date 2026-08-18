// Dependency-free ESM resolver hook.
//
// The Showzy source uses the NodeNext convention: a ".ts" module imports its
// siblings with ".js" specifiers (what the compiled output would reference).
// Node's built-in type stripping runs ".ts" files directly but does NOT remap
// a ".js" specifier to its ".ts" source, so running an entrypoint such as
// `node apps/api/src/index.ts` fails with ERR_MODULE_NOT_FOUND.
//
// This hook fills that single gap: when a ".js" specifier cannot be resolved
// and the importer is a TypeScript module, it retries against the ".ts"
// sibling. Native resolution always wins first, so real ".js" files are never
// shadowed. It is used only to run the app from source in development; the
// build pipeline (tsc/esbuild) is unaffected.
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tsExtensions = [".ts", ".mts", ".cts", ".tsx"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      err?.code !== "ERR_MODULE_NOT_FOUND" ||
      !specifier.endsWith(".js") ||
      context.parentURL === undefined
    ) {
      throw err;
    }
    const targetPath = fileURLToPath(new URL(specifier, context.parentURL));
    const withoutExt = targetPath.slice(0, -extname(targetPath).length);
    for (const ext of tsExtensions) {
      const candidate = withoutExt + ext;
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw err;
  }
}
