/**
 * Native device prefs (MMKV). Session cookies stay in SecureStore; this instance
 * id is prefs-only. Web must not import this file — Metro selects it
 * via the `.native` suffix.
 */
import { createMMKV } from "react-native-mmkv";

import { createDevicePrefs, type DevicePrefs } from "./device-prefs";
import { assertDevicePrefKey, type PrefsKvStore } from "./storage";

const MMKV_PREFS_ID = "showzy.prefs";

function createMmkvPrefsStore(): PrefsKvStore {
  const mmkv = createMMKV({ id: MMKV_PREFS_ID });
  return {
    get(key) {
      assertDevicePrefKey(key);
      return mmkv.getString(key) ?? null;
    },
    set(key, value) {
      assertDevicePrefKey(key);
      mmkv.set(key, value);
    },
    remove(key) {
      assertDevicePrefKey(key);
      mmkv.remove(key);
    },
  };
}

let singleton: DevicePrefs | undefined;

export function createPlatformDevicePrefs(): DevicePrefs {
  singleton ??= createDevicePrefs(createMmkvPrefsStore());
  return singleton;
}
