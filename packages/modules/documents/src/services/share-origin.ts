import { CoreInvariantError } from "@showzy/core/errors";

let origin: string | undefined;

/**
 * Public origin for `/d/{token}` URLs. Bound at process boot from
 * `BETTER_AUTH_URL` (`config.auth.url`) — no extra env.
 */
export function configureDocumentShareOrigin(url: string): void {
  origin = url.replace(/\/$/, "");
}

export function clearDocumentShareOrigin(): void {
  origin = undefined;
}

export function getDocumentShareOrigin(): string {
  if (origin === undefined) {
    throw new CoreInvariantError(
      "document share origin is not configured — bind it at process boot",
    );
  }
  return origin;
}
