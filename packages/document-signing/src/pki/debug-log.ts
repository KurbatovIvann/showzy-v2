/**
 * Optional debug-log hook for errors this package intentionally swallows
 * (best-effort CA registry fetches, storage cleanup, proxy HTTP handlers).
 * Hosts inject a callback at boot (SHO-282); when none is set the swallow
 * stays silent, exactly as before. Deliberately not a logger dependency —
 * this package ships to web and native bundles.
 */
export type PkiDebugLog = (context: string, error: unknown) => void;

let hook: PkiDebugLog | undefined;

export function setPkiDebugLog(log: PkiDebugLog | undefined): void {
  hook = log;
}

/** Report a swallowed error to the injected hook, never throwing. */
export function pkiDebugLog(context: string, error: unknown): void {
  if (hook === undefined) {
    return;
  }
  try {
    hook(context, error);
  } catch {
    // A broken debug hook must not break the best-effort path it observes.
  }
}
