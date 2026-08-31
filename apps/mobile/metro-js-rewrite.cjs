/**
 * Workspace packages compile with NodeNext (`.js` specifiers pointing at
 * `.ts` sources). Only rewrite those misses for `@showzy/` specifiers —
 * not every failed `.js` resolve in node_modules.
 *
 * @param {string} moduleName
 * @param {string | undefined} originModulePath
 * @returns {boolean}
 */
function shouldRewriteNodeNextJsSpecifier(moduleName, originModulePath) {
  if (typeof moduleName !== "string" || !moduleName.endsWith(".js")) {
    return false;
  }
  if (moduleName.startsWith("@showzy/")) {
    return true;
  }
  if (typeof originModulePath !== "string") {
    return false;
  }
  return (
    originModulePath.includes("/node_modules/@showzy/") ||
    /\/packages\/[A-Za-z0-9._-]+\//u.test(originModulePath)
  );
}

/**
 * @param {string} moduleName
 * @returns {string}
 */
function rewriteJsSpecifierToTs(moduleName) {
  return moduleName.replace(/\.js$/u, ".ts");
}

module.exports = {
  shouldRewriteNodeNextJsSpecifier,
  rewriteJsSpecifierToTs,
};
