/**
 * Client-side env. Empty string is unset — same convention as
 * `@showzy/config`, but this package must not import that server package.
 */

export class MobileConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MobileConfigError";
  }
}

export function resolveApiUrl(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new MobileConfigError("EXPO_PUBLIC_API_URL is not set");
  }
  return value.replace(/\/+$/, "");
}

export function apiUrlFromEnv(
  env: { readonly EXPO_PUBLIC_API_URL?: string } = expoPublicEnv(),
): string {
  return resolveApiUrl(env.EXPO_PUBLIC_API_URL);
}

function expoPublicEnv(): { readonly EXPO_PUBLIC_API_URL?: string } {
  const value = process.env["EXPO_PUBLIC_API_URL"];
  return value === undefined ? {} : { EXPO_PUBLIC_API_URL: value };
}
