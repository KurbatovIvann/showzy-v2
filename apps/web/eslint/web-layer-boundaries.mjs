/**
 * apps/web layer direction (SHO-329 / SHO-326). Specifier + importer path,
 * same strategy as `showzy/import-boundaries`, so pnpm layout cannot
 * skip the rule. No per-file path exceptions.
 */
import path from "node:path";

/**
 * @param {string} filename
 */
function toPosix(filename) {
  return filename.replaceAll("\\", "/");
}

/**
 * @param {string} filename
 * @returns {{ root: string, rel: string } | null}
 */
function webSrc(filename) {
  const posix = toPosix(filename);
  const marker = "/apps/web/src/";
  const index = posix.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return {
    root: posix.slice(0, index + marker.length - 1),
    rel: posix.slice(index + marker.length),
  };
}

/**
 * @param {string} rel
 */
function stripExt(rel) {
  return rel.replace(/\.(?:tsx|ts|jsx|js|mjs)$/, "");
}

/**
 * @param {string} rel
 */
function classify(rel) {
  const file = stripExt(rel);
  if (file.startsWith("routes/")) {
    return { kind: "routes" };
  }
  if (file.startsWith("components/ui/")) {
    return { kind: "ui" };
  }
  if (file.startsWith("api/")) {
    return { kind: "api" };
  }
  if (file.startsWith("app/")) {
    return { kind: "app" };
  }
  if (file.startsWith("layouts/")) {
    return { kind: "layouts" };
  }
  const feature = /^features\/([^/]+)\//.exec(file);
  if (feature !== null && feature[1] !== undefined) {
    return { kind: "feature", area: feature[1] };
  }
  if (file.startsWith("auth/")) {
    return { kind: "auth" };
  }
  if (file.startsWith("prefs/")) {
    return { kind: "prefs" };
  }
  if (file.startsWith("i18n/")) {
    return { kind: "i18n" };
  }
  if (file.startsWith("theme/")) {
    return { kind: "theme" };
  }
  return { kind: "other" };
}

/**
 * @param {string} rel
 */
function featureArea(rel) {
  const match = /^features\/([^/]+)\//.exec(stripExt(rel));
  return match?.[1];
}

/**
 * Route adapters may import feature screens/layouts/pages and feature
 * `api/` query options (prefetch). Everything else in a feature is
 * internals.
 *
 * @param {string} rel
 */
function isFeaturePageOrApiEntry(rel) {
  const file = stripExt(rel);
  if (!file.startsWith("features/")) {
    return false;
  }
  if (/^features\/[^/]+\/api\//.test(file)) {
    return true;
  }
  return /(?:^|\/)[^/]+-(?:screen|layout|page)$/.test(file);
}

/**
 * Cross-feature consumption uses `features/<area>/shared/`, not a
 * barrel and not another domain's internals.
 *
 * @param {string} rel
 */
function isFeatureShared(rel) {
  return /^features\/[^/]+\/shared\//.test(stripExt(rel));
}

/**
 * Prefetch helpers only — not the oRPC client or mutation runtime.
 *
 * @param {string} rel
 */
function isApiPrefetchHelper(rel) {
  const file = stripExt(rel);
  return file === "api/query-options" || file === "api/query-client";
}

/**
 * @param {string} rel
 */
function isApiClient(rel) {
  return stripExt(rel) === "api/client";
}

/**
 * @param {import("estree").Node} node
 * @returns {string | null}
 */
function specifier(node) {
  if (
    "source" in node &&
    node.source !== null &&
    typeof node.source === "object" &&
    "value" in node.source &&
    typeof node.source.value === "string"
  ) {
    return node.source.value;
  }
  return null;
}

/**
 * @param {string} importerFile
 * @param {string} spec
 * @returns {{ kind: "package", spec: string } | { kind: "src", rel: string } | null}
 */
function resolveImported(importerFile, spec) {
  if (!spec.startsWith(".")) {
    return { kind: "package", spec };
  }
  const src = webSrc(importerFile);
  if (src === null) {
    return null;
  }
  const fromDir = path.posix.dirname(toPosix(importerFile));
  const resolved = path.posix.normalize(path.posix.join(fromDir, spec));
  const marker = "/apps/web/src/";
  const index = resolved.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return { kind: "src", rel: resolved.slice(index + marker.length) };
}

/**
 * @param {{ kind: string, area?: string }} from
 * @param {{ kind: "package", spec: string } | { kind: "src", rel: string }} imported
 * @returns {string | null}
 */
function violation(from, imported) {
  if (from.kind === "app") {
    return null;
  }

  if (imported.kind === "package") {
    if (from.kind === "routes" && imported.spec === "@showzy/contract") {
      return "routesContractClient";
    }
    if (from.kind === "ui" && imported.spec.startsWith("@showzy/contract")) {
      return "uiFeatureOrApi";
    }
    return null;
  }

  const target = classify(imported.rel);

  if (from.kind === "routes") {
    if (isApiClient(imported.rel)) {
      return "routesContractClient";
    }
    if (target.kind === "api" && !isApiPrefetchHelper(imported.rel)) {
      return "routesContractClient";
    }
    if (target.kind === "feature" && !isFeaturePageOrApiEntry(imported.rel)) {
      return "routesFeatureInternal";
    }
    if (
      target.kind === "ui" ||
      target.kind === "prefs" ||
      target.kind === "i18n" ||
      target.kind === "theme"
    ) {
      return "routesFeatureInternal";
    }
    return null;
  }

  if (from.kind === "ui") {
    if (
      target.kind === "feature" ||
      target.kind === "api" ||
      target.kind === "routes" ||
      target.kind === "layouts" ||
      target.kind === "app" ||
      target.kind === "auth"
    ) {
      return "uiFeatureOrApi";
    }
    return null;
  }

  if (from.kind === "api") {
    if (
      target.kind === "feature" ||
      target.kind === "ui" ||
      target.kind === "routes" ||
      target.kind === "layouts" ||
      target.kind === "app"
    ) {
      return "apiFeatureOrUi";
    }
    return null;
  }

  if (from.kind === "feature") {
    const other = featureArea(imported.rel);
    if (
      other !== undefined &&
      other !== from.area &&
      !isFeatureShared(imported.rel)
    ) {
      return "featureForeignInternal";
    }
    if (target.kind === "routes") {
      return "featureForeignInternal";
    }
    return null;
  }

  if (from.kind === "layouts") {
    if (isApiClient(imported.rel)) {
      return "layoutsForeignFeature";
    }
    if (
      target.kind === "feature" &&
      featureArea(imported.rel) !== "companies"
    ) {
      return "layoutsForeignFeature";
    }
    if (target.kind === "routes" || target.kind === "app") {
      return "layoutsForeignFeature";
    }
    return null;
  }

  if (from.kind === "auth" || from.kind === "prefs" || from.kind === "i18n") {
    if (
      target.kind === "feature" ||
      target.kind === "layouts" ||
      target.kind === "routes" ||
      target.kind === "ui" ||
      (from.kind !== "auth" && target.kind === "api")
    ) {
      return "featureForeignInternal";
    }
    return null;
  }

  return null;
}

export const webLayerBoundariesRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce apps/web feature/page/layout import direction (SHO-329).",
    },
    schema: [],
    messages: {
      routesContractClient:
        "Route adapters may not import the contract client (`src/api/client` or `@showzy/contract`). Prefetch with `api/query-options` or a feature `api/` entry.",
      routesFeatureInternal:
        "Route adapters may import only feature page/layout/screen entries, feature `api/` (prefetch), layouts, auth session gates, and `app/` types.",
      uiFeatureOrApi:
        "Generic UI primitives may not import features, API, routes, layouts, or auth.",
      apiFeatureOrUi:
        "Shared `src/api` may not import features, UI, routes, layouts, or `app/`.",
      featureForeignInternal:
        "Feature internals may not import another domain's internals (use that domain's `shared/` entry when one exists).",
      layoutsForeignFeature:
        "Layouts may compose `features/companies` (switcher/scope) and UI/auth/i18n — not other domains, routes, or `api/client`.",
    },
  },
  create(context) {
    const filename = context.filename;
    if (/\.test\.(ts|tsx)$/.test(filename)) {
      return {};
    }
    const src = webSrc(filename);
    if (src === null) {
      return {};
    }
    if (src.rel.startsWith("test/") || src.rel === "routeTree.gen.ts") {
      return {};
    }
    const from = classify(src.rel);
    if (from.kind === "other" || from.kind === "theme") {
      return {};
    }

    /**
     * @param {import("estree").Node} node
     */
    function check(node) {
      const spec = specifier(node);
      if (spec === null) {
        return;
      }
      const imported = resolveImported(filename, spec);
      if (imported === null) {
        return;
      }
      const messageId = violation(from, imported);
      if (messageId !== null) {
        context.report({ node, messageId });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};
