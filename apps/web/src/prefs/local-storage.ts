/**
 * localStorage adapter for panel prefs (ADR-0030, web-panel-architecture).
 */
import { assertDevicePrefKey, type PrefsKvStore } from "./storage";

export function createLocalStoragePrefsStore(
  storage: Pick<
    Storage,
    "getItem" | "setItem" | "removeItem"
  > = window.localStorage,
): PrefsKvStore {
  return {
    get(key) {
      assertDevicePrefKey(key);
      return storage.getItem(key);
    },
    set(key, value) {
      assertDevicePrefKey(key);
      storage.setItem(key, value);
    },
    remove(key) {
      assertDevicePrefKey(key);
      storage.removeItem(key);
    },
  };
}
