/**
 * Web + Vitest device prefs: in-memory only. Must not write theme or
 * the company selector to `localStorage` (react-native-mmkv's web
 * backend does). Native uses `platform-storage.native.ts`.
 */
import { createDevicePrefs, type DevicePrefs } from "./device-prefs";
import { createMemoryPrefsStore } from "./storage";

let singleton: DevicePrefs | undefined;

export function createPlatformDevicePrefs(): DevicePrefs {
  singleton ??= createDevicePrefs(createMemoryPrefsStore());
  return singleton;
}
