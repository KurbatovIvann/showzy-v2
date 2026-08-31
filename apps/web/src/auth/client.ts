/**
 * better-auth React client for the staff panel (ADR-0006, ADR-0030).
 * Browser cookies via same-origin `/api/auth` — no Expo plugin, no
 * manual token / `document.cookie` (session cookies are HttpOnly).
 *
 * `better-auth` may be imported only under `src/auth/`.
 */
import { emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export function panelOrigin(): string {
  if (typeof window === "undefined") {
    return "http://localhost";
  }
  return window.location.origin;
}

type ShowzyAuthClientOptions = {
  readonly baseURL?: string;
  readonly sessionOptions?: {
    readonly refetchOnWindowFocus?: boolean;
  };
};

export function createShowzyAuthClient(options: ShowzyAuthClientOptions = {}) {
  return createAuthClient({
    baseURL: options.baseURL ?? panelOrigin(),
    plugins: [phoneNumberClient(), emailOTPClient()],
    ...(options.sessionOptions === undefined
      ? {}
      : { sessionOptions: options.sessionOptions }),
  });
}

export type ShowzyAuthClient = ReturnType<typeof createShowzyAuthClient>;

/**
 * Run nanostores `clean` on the session atom while `window` still exists.
 *
 * `useSession` mounts better-auth's session atom, which registers
 * `cleanupBroadcastSetup` (`window.removeEventListener("storage")`).
 * Nanostores delays that destroy by `STORE_UNMOUNT_DELAY` (1000ms) after
 * the last subscriber. Vitest tears down jsdom at the end of the file
 * first — the leftover timer then throws `ReferenceError: window is not
 * defined` (SHO-317).
 */
export function disposeShowzyAuthClient(client: ShowzyAuthClient): void {
  const atoms = client.$store.atoms as {
    readonly session?: object;
    readonly $sessionSignal?: object;
  };
  runNanostoresClean(atoms.session);
  runNanostoresClean(atoms.$sessionSignal);
}

/**
 * `better-auth/react` re-exports nanostores types but not `cleanStores`
 * at runtime. The atom's test `clean` symbol runs onMount destroy
 * immediately (sets `active = false` so the delayed timer is a no-op).
 */
function runNanostoresClean(store: object | undefined): void {
  if (store === undefined) {
    return;
  }
  for (const key of Object.getOwnPropertySymbols(store)) {
    if (key.description !== "clean") {
      continue;
    }
    const method: unknown = Reflect.get(store, key);
    if (typeof method === "function") {
      Reflect.apply(method, store, []);
    }
  }
}
