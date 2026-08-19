const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

/**
 * Workspace packages compile with NodeNext (`.js` specifiers pointing at
 * `.ts` sources). Metro does not rewrite that; T49 is the first route that
 * imports `@showzy/contract`, so resolve `.js` → `.ts` on miss.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (typeof moduleName === "string" && moduleName.endsWith(".js")) {
      return context.resolveRequest(
        context,
        moduleName.replace(/\.js$/u, ".ts"),
        platform,
      );
    }
    throw error;
  }
};

module.exports = config;
