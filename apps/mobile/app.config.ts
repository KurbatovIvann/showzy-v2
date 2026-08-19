import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Showzy",
  slug: "showzy",
  version: "0.0.0",
  scheme: "showzy",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router"],
  experiments: {
    tsconfigPaths: true,
  },
  ios: {
    bundleIdentifier: "com.showzy.app",
    supportsTablet: true,
  },
  android: {
    package: "com.showzy.app",
  },
  web: {
    bundler: "metro",
  },
});
