import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };
import { expoConfigPlugins } from "../app.config";

/** Packages whose native code must ship in the first custom dev-client binary. */
const nativeKitPackages = [
  "@react-native-community/datetimepicker",
  "@react-native-community/netinfo",
  "@react-native-community/slider",
  "@shopify/flash-list",
  "expo-audio",
  "expo-build-properties",
  "expo-clipboard",
  "expo-crypto",
  "expo-dev-client",
  "expo-device",
  "expo-document-picker",
  "expo-file-system",
  "expo-haptics",
  "expo-image",
  "expo-image-manipulator",
  "expo-image-picker",
  "expo-localization",
  "expo-media-library",
  "expo-network",
  "expo-notifications",
  "expo-sharing",
  "expo-system-ui",
  "expo-task-manager",
  "expo-web-browser",
  "lucide-react-native",
  "react-native-keyboard-controller",
  "react-native-mmkv",
  "react-native-pager-view",
  "react-native-svg",
  "react-native-view-shot",
  "react-native-webview",
] as const;

const requiredPlugins = [
  "expo-build-properties",
  "expo-dev-client",
  "expo-router",
  "expo-secure-store",
  "expo-localization",
  "expo-image",
  "expo-sharing",
  "expo-web-browser",
  "@react-native-community/datetimepicker",
  "expo-audio",
  "expo-file-system",
  "expo-image-picker",
  "expo-media-library",
  "expo-document-picker",
  "expo-notifications",
] as const;

function pluginName(plugin: (typeof expoConfigPlugins)[number]): string {
  if (typeof plugin === "string") {
    return plugin;
  }
  const name = plugin[0];
  if (typeof name !== "string") {
    throw new Error("native kit plugins must be named strings");
  }
  return name;
}

describe("mobile native kit", () => {
  it("keeps rebuild-sensitive packages in dependencies", () => {
    for (const name of nativeKitPackages) {
      expect(packageJson.dependencies[name], name).toBeDefined();
    }
  });

  it("registers config plugins so permission keys land in the first binary", () => {
    const names = expoConfigPlugins.map(pluginName);
    for (const name of requiredPlugins) {
      expect(names, name).toContain(name);
    }
  });
});
