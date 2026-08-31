const { getDefaultConfig } = require("expo/metro-config");
const {
  shouldRewriteNodeNextJsSpecifier,
  rewriteJsSpecifierToTs,
} = require("./metro-js-rewrite.cjs");

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

/**
 * Workspace packages compile with NodeNext (`.js` specifiers pointing at
 * `.ts` sources). Metro does not rewrite that; T49 is the first route that
 * imports `@showzy/contract`, so resolve `.js` → `.ts` on miss — only for
 * `@showzy/` specifiers (SHO-297).
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (
      shouldRewriteNodeNextJsSpecifier(moduleName, context.originModulePath)
    ) {
      return context.resolveRequest(
        context,
        rewriteJsSpecifierToTs(moduleName),
        platform,
      );
    }
    throw error;
  }
};

module.exports = config;
