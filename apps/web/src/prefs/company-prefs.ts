/**
 * Last visited company slug. UX only — never an access grant (ADR-0013).
 * The URL slug is the source of truth; this is the `/` redirect hint.
 */
import { createLocalStoragePrefsStore } from "./local-storage";
import {
  DEVICE_PREF_LAST_COMPANY_SLUG_KEY,
  type PrefsKvStore,
} from "./storage";

export interface CompanyPrefs {
  getLastCompanySlug(): string | null;
  setLastCompanySlug(slug: string | null): void;
}

export function createCompanyPrefs(kv: PrefsKvStore): CompanyPrefs {
  return {
    getLastCompanySlug() {
      const raw = kv.get(DEVICE_PREF_LAST_COMPANY_SLUG_KEY);
      if (raw === null || raw.trim() === "") {
        return null;
      }
      return raw;
    },
    setLastCompanySlug(slug) {
      if (slug === null || slug.trim() === "") {
        kv.remove(DEVICE_PREF_LAST_COMPANY_SLUG_KEY);
        return;
      }
      kv.set(DEVICE_PREF_LAST_COMPANY_SLUG_KEY, slug);
    },
  };
}

export function createBrowserCompanyPrefs(): CompanyPrefs {
  return createCompanyPrefs(createLocalStoragePrefsStore());
}
