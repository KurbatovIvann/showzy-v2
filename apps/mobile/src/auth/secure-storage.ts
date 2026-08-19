/**
 * Native bearer storage (security-operations §2). Web is not a product
 * surface (fnd-T48 export smoke only) and keeps the token in memory so
 * `expo export --platform web` does not persist it to localStorage.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  ACCESS_TOKEN_KEY,
  createMemoryTokenStore,
  type TokenStore,
} from "./storage";

const nativeOptions: SecureStore.SecureStoreOptions = {
  keychainService: "showzy.auth",
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export function createPlatformTokenStore(): TokenStore {
  if (Platform.OS === "web") {
    return createMemoryTokenStore();
  }
  return {
    async get() {
      try {
        return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY, nativeOptions);
      } catch {
        return null;
      }
    },
    async set(token) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token, nativeOptions);
    },
    async clear() {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, nativeOptions);
    },
  };
}
