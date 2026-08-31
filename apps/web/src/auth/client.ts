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

export function createShowzyAuthClient(
  options: {
    readonly baseURL?: string;
  } = {},
) {
  return createAuthClient({
    baseURL: options.baseURL ?? panelOrigin(),
    plugins: [phoneNumberClient(), emailOTPClient()],
  });
}

export type ShowzyAuthClient = ReturnType<typeof createShowzyAuthClient>;
