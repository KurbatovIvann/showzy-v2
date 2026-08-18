/**
 * ESM resolve hook so `node --experimental-strip-types` can load the
 * backup-verify CLI: NodeNext sources import siblings with `.js`
 * specifiers, and type-stripping does not remap those to `.ts`.
 * Native resolution always wins first (real `.js` files are not shadowed).
 */
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const tsExtensions = [".ts", ".mts", ".cts"];

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
