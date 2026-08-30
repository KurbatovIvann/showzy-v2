/**
 * Device fetch/PUT must not leak signed URLs into Error.message.
 * AbortErrors stay AbortErrors so dismiss still cancels.
 */
import { isSafeHttpUrl } from "../shared/is-safe-http-url";

export function assertSafeSigningUrl(url: string): void {
  if (!isSafeHttpUrl(url)) {
    throw new TypeError("Failed to fetch");
  }
}

export function isSigningAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function wrapSigningNetworkFailure(
  error: unknown,
  signal: AbortSignal,
): never {
  if (signal.aborted || isSigningAbortError(error)) {
    if (error instanceof Error) {
      throw error;
    }
    const aborted = new Error("aborted");
    aborted.name = "AbortError";
    throw aborted;
  }
  throw new TypeError("Failed to fetch");
}
