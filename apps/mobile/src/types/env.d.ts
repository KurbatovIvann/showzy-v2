/**
 * Expo inlines `EXPO_PUBLIC_*` at bundle time. This ambient keeps the
 * client tsconfig (`types: []`) from needing `@types/node`.
 */
declare const process: {
  readonly env: {
    readonly EXPO_PUBLIC_API_URL?: string;
  };
};
