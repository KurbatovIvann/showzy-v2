/**
 * Best-effort remote sign-out that always drops the local cookie jar.
 * Offline / 401 sign-out must not leave a dead session cookie behind.
 */
import {
  AUTH_COOKIE_KEY,
  AUTH_SESSION_CACHE_KEY,
  type ExpoAuthStorage,
} from "./storage";

export function clearLocalAuthJar(storage: ExpoAuthStorage): void {
  void storage.setItem(AUTH_COOKIE_KEY, "");
  void storage.setItem(AUTH_SESSION_CACHE_KEY, "");
}

export async function signOutClearingLocalJar(args: {
  readonly signOutRemote: () => Promise<unknown>;
  readonly storage: ExpoAuthStorage;
}): Promise<void> {
  try {
    await args.signOutRemote();
  } catch {
    // Best-effort server revocation; the local jar still has to go.
  } finally {
    clearLocalAuthJar(args.storage);
  }
}
