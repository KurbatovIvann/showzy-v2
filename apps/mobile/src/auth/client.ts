/**
 * Official better-auth Expo client (cookie jar in SecureStore).
 * Do not import this module from `@showzy/contract`.
 */
import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { ExpoAuthStorage } from "./storage";

export const EXPO_AUTH_SCHEME = "showzy";

export function createShowzyAuthClient(options: {
  readonly baseURL: string;
  readonly storage: ExpoAuthStorage;
}) {
  return createAuthClient({
    baseURL: options.baseURL,
    disableDefaultFetchPlugins: true,
    plugins: [
      expoClient({
        scheme: EXPO_AUTH_SCHEME,
        storagePrefix: "showzy",
        storage: options.storage,
      }),
      phoneNumberClient(),
      emailOTPClient(),
    ],
  });
}

export type ShowzyAuthClient = ReturnType<typeof createShowzyAuthClient>;
