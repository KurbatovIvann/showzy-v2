/**
 * CI bundle probe (contract.md §2, ADR-0016, fnd-T25).
 *
 * Bundles a minimal client entry with esbuild (browser platform) and fails
 * when the graph reaches Node builtins, `packages/db`, core server paths,
 * or `@showzy/contract/server`. `@showzy/core/contract` is allowed.
 *
 * Usage:
 *   node scripts/bundle-probe.mjs              # probe the real client entry
 *   node scripts/bundle-probe.mjs <entry.ts>   # probe a fixture (tests)
 */
import * as esbuild from "esbuild";
import { builtinModules } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageRoot, "../..");

const defaultEntry = path.join(packageRoot, "probe", "entry.ts");

const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((name) =>
    name.startsWith("node:") ? name.slice("node:".length) : `node:${name}`,
  ),
]);

/**
 * @param {string} specifier
 */
function isForbiddenSpecifier(specifier) {
  if (specifier.startsWith("node:") || NODE_BUILTINS.has(specifier)) {
    return `Node builtin "${specifier}"`;
  }
  if (specifier === "@showzy/db" || specifier.startsWith("@showzy/db/")) {
    return `"${specifier}"`;
  }
  if (specifier === "@showzy/core" || specifier.startsWith("@showzy/core/")) {
    if (
      specifier === "@showzy/core/contract" ||
      specifier.startsWith("@showzy/core/contract/")
    ) {
      return null;
    }
    return `"${specifier}"`;
  }
  if (
    specifier === "@showzy/contract/server" ||
    specifier.startsWith("@showzy/contract/server/")
  ) {
    return `"${specifier}"`;
  }
  return null;
}

/**
 * @param {string} resolved
 */
function isForbiddenResolvedPath(resolved) {
  const posix = resolved.replaceAll("\\", "/");
  if (posix.includes("/packages/db/")) {
    return "packages/db";
  }
  if (posix.includes("/packages/contract/src/server/")) {
    return "packages/contract/src/server";
  }
  if (posix.includes("/packages/core/src/contract/")) {
    return null;
  }
  if (posix.includes("/packages/core/src/")) {
    return "packages/core server path";
  }
  const moduleMatch = /\/packages\/modules\/[^/]+\/(.*)$/.exec(posix);
  if (moduleMatch !== null) {
    const rest = moduleMatch[1] ?? "";
    if (rest.endsWith(".contract.ts") || rest === "index.contract.ts") {
      return null;
    }
    return "module server file";
  }
  return null;
}

/**
 * @param {string} entry
 * @returns {Promise<void>}
 */
export async function runBundleProbe(entry = defaultEntry) {
  /** @type {string[]} */
  const leaks = [];
  try {
    await esbuild.build({
      absWorkingDir: repoRoot,
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: "browser",
      format: "esm",
      logLevel: "silent",
      plugins: [
        {
          name: "forbid-server-imports",
          setup(build) {
            build.onResolve({ filter: /.*/ }, async (args) => {
              if (args.pluginData === true) {
                return undefined;
              }
              const specifierLeak = isForbiddenSpecifier(args.path);
              if (specifierLeak !== null) {
                leaks.push(
                  `${specifierLeak} imported from ${args.importer || entry}`,
                );
                return { path: args.path, namespace: "forbidden" };
              }
              const resolved = await build.resolve(args.path, {
                importer: args.importer,
                resolveDir: args.resolveDir,
                kind: args.kind,
                pluginData: true,
              });
              if (resolved.errors.length > 0 || resolved.path === "") {
                return undefined;
              }
              const pathLeak = isForbiddenResolvedPath(resolved.path);
              if (pathLeak !== null) {
                leaks.push(
                  `${pathLeak} via "${args.path}" from ${args.importer || entry}`,
                );
                return { path: args.path, namespace: "forbidden" };
              }
              return undefined;
            });
            build.onLoad({ filter: /.*/, namespace: "forbidden" }, () => ({
              contents: "export default undefined;",
              loader: "js",
            }));
          },
        },
      ],
    });
  } catch (error) {
    if (leaks.length === 0) {
      throw error;
    }
  }
  if (leaks.length > 0) {
    const unique = [...new Set(leaks)];
    throw new Error(
      `Bundle probe failed — server import leak:\n${unique.map((line) => `  - ${line}`).join("\n")}`,
    );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  const entry = process.argv[2] ?? defaultEntry;
  try {
    await runBundleProbe(path.resolve(entry));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
