import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Config plugins for the preinstalled native kit. Permission strings live
 * here so the first product screen that uses camera, photos, microphone,
 * files, or push does not force another Expo/dev-client rebuild.
 */
export const expoConfigPlugins: NonNullable<ExpoConfig["plugins"]> = [
  [
    "expo-build-properties",
    {
      android: {
        usesCleartextTraffic: true,
      },
    },
  ],
  "expo-dev-client",
  "expo-router",
  "expo-secure-store",
  "expo-localization",
  "expo-image",
  "expo-sharing",
  "expo-web-browser",
  "@react-native-community/datetimepicker",
  [
    "expo-audio",
    {
      microphonePermission: "Allow $(PRODUCT_NAME) to record voice messages.",
      recordAudioAndroid: true,
      enableBackgroundPlayback: true,
      enableBackgroundRecording: false,
    },
  ],
  [
    "expo-file-system",
    {
      supportsOpeningDocumentsInPlace: true,
      enableFileSharing: true,
    },
  ],
  [
    "expo-image-picker",
    {
      photosPermission:
        "Allow $(PRODUCT_NAME) to access your photos so you can attach product and document images.",
      cameraPermission:
        "Allow $(PRODUCT_NAME) to take photos for products and documents.",
      microphonePermission: false,
    },
  ],
  [
    "expo-media-library",
    {
      photosPermission:
        "Allow $(PRODUCT_NAME) to access your photo library for product images and attachments.",
      savePhotosPermission:
        "Allow $(PRODUCT_NAME) to save images to your photo library.",
      isAccessMediaLocationEnabled: false,
      granularPermissions: ["photo", "video", "audio"],
    },
  ],
  "expo-document-picker",
  [
    "expo-notifications",
    {
      enableBackgroundRemoteNotifications: true,
    },
  ],
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Showzy",
  slug: "showzy",
  owner: "showzy-organization",
  version: "0.0.0",
  scheme: "showzy",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  extra: {
    ...config.extra,
    eas: {
      projectId: "0cedd12b-3114-4375-b7bb-b680b24a621f",
    },
  },
  plugins: expoConfigPlugins,
  experiments: {
    tsconfigPaths: true,
  },
  ios: {
    bundleIdentifier: "com.showzy.app",
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    package: "com.showzy.app",
  },
  web: {
    bundler: "metro",
  },
});
