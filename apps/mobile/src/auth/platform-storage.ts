/**
 * Cookie jar backing `@better-auth/expo`. The plugin's getItem is
 * synchronous; expo-secure-store is async, so native storage is a memory
 * map hydrated once at boot and persisted on write. Web stays in-memory
 * so `expo export --platform web` does not persist cookies.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  AUTH_COOKIE_KEY,
  AUTH_STORAGE_PREFIX,
  createMemoryAuthStorage,
  type ExpoAuthStorage,
} from "./storage";

const SESSION_CACHE_KEY = `${AUTH_STORAGE_PREFIX}_session_data`;
/** Matches `@better-auth/expo` storageAdapter chunk marker. */
const CHUNK_MARKER = "\u0001ba-chunks:";

const nativeOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function createPlatformAuthStorage(): Promise<ExpoAuthStorage> {
  if (Platform.OS === "web") {
    return createMemoryAuthStorage();
  }
  const memory = createMemoryAuthStorage();
  await hydrateNativeKey(memory, AUTH_COOKIE_KEY);
  await hydrateNativeKey(memory, SESSION_CACHE_KEY);
  return {
    getItem: memory.getItem,
    setItem: (key, value) => {
      void memory.setItem(key, value);
      if (value === "") {
        void SecureStore.deleteItemAsync(key, nativeOptions).catch(
          () => undefined,
        );
        return;
      }
      void SecureStore.setItemAsync(key, value, nativeOptions).catch(
        () => undefined,
      );
    },
  };
}

async function hydrateNativeKey(
  memory: ExpoAuthStorage,
  key: string,
): Promise<void> {
  try {
    const value = await SecureStore.getItemAsync(key, nativeOptions);
    if (value === null) {
      return;
    }
    await memory.setItem(key, value);
    if (!value.startsWith(CHUNK_MARKER)) {
      return;
    }
    const count = Number(value.slice(CHUNK_MARKER.length));
    if (!Number.isInteger(count) || count < 1) {
      return;
    }
    for (let index = 0; index < count; index += 1) {
      const chunkKey = `${key}.${String(index)}`;
      const chunk = await SecureStore.getItemAsync(chunkKey, nativeOptions);
      if (chunk !== null) {
        await memory.setItem(chunkKey, chunk);
      }
    }
  } catch {
    // Missing key or unavailable store — start empty.
  }
}
