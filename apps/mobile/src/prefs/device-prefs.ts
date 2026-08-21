/**
 * Typed device prefs: theme + last staff company selector.
 * The selector is UX only — never an access grant (ADR-0013).
 */
import {
  themeModeFromStoredValue,
  type ThemeMode,
  type ThemePreferenceStore,
} from "../theme/preference";
import {
  DEVICE_PREF_LAST_COMPANY_KEY,
  DEVICE_PREF_THEME_KEY,
  type PrefsKvStore,
} from "./storage";

export interface DevicePrefs {
  getTheme(): ThemeMode;
  setTheme(mode: ThemeMode): void;
  getLastCompanyId(): string | null;
  setLastCompanyId(companyId: string | null): void;
}

export type CompanySelectorClient = {
  setActiveCompany(companyId: string | null): void;
  getActiveCompany(): string | null;
};

export function createDevicePrefs(kv: PrefsKvStore): DevicePrefs {
  return {
    getTheme() {
      return themeModeFromStoredValue(kv.get(DEVICE_PREF_THEME_KEY));
    },
    setTheme(mode) {
      kv.set(DEVICE_PREF_THEME_KEY, mode);
    },
    getLastCompanyId() {
      const raw = kv.get(DEVICE_PREF_LAST_COMPANY_KEY);
      if (raw === null || raw.trim() === "") {
        return null;
      }
      return raw;
    },
    setLastCompanyId(companyId) {
      if (companyId === null || companyId.trim() === "") {
        kv.remove(DEVICE_PREF_LAST_COMPANY_KEY);
        return;
      }
      kv.set(DEVICE_PREF_LAST_COMPANY_KEY, companyId);
    },
  };
}

export function asThemePreferenceStore(
  prefs: Pick<DevicePrefs, "getTheme" | "setTheme">,
): ThemePreferenceStore {
  return {
    get: () => prefs.getTheme(),
    set: (mode) => {
      prefs.setTheme(mode);
    },
  };
}

/**
 * Persist the staff selector on every `setActiveCompany`. Sign-out and
 * session-loss already call `setActiveCompany(null)` (SHO-102); that
 * clears the stored selector and leaves theme untouched.
 */
export function bindCompanySelectorPersistence(
  client: CompanySelectorClient,
  prefs: Pick<DevicePrefs, "setLastCompanyId">,
): () => void {
  const original = client.setActiveCompany.bind(client);
  client.setActiveCompany = (companyId: string | null): void => {
    original(companyId);
    prefs.setLastCompanyId(companyId);
  };
  return (): void => {
    client.setActiveCompany = original;
  };
}

/**
 * After a live session hydrate (or sign-in), restore the last selector
 * if the client does not already have one. No-op when unsigned.
 */
export function restoreLastCompanySelector(
  client: CompanySelectorClient,
  prefs: Pick<DevicePrefs, "getLastCompanyId">,
): void {
  if (client.getActiveCompany() !== null) {
    return;
  }
  const last = prefs.getLastCompanyId();
  if (last === null) {
    return;
  }
  client.setActiveCompany(last);
}

export function restoreLastCompanySelectorIfSignedIn(
  client: CompanySelectorClient,
  prefs: Pick<DevicePrefs, "getLastCompanyId">,
  sessionUser: unknown,
): void {
  if (sessionUser === null) {
    return;
  }
  restoreLastCompanySelector(client, prefs);
}
