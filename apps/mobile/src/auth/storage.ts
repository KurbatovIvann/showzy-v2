/**
 * Bearer-token persistence. Native uses OS secure storage
 * (`expo-secure-store`); tests and web use this in-memory store.
 * The value is never logged.
 */
export const ACCESS_TOKEN_KEY = "showzy.auth.access-token";

export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryTokenStore(
  initial: string | null = null,
): TokenStore {
  let value = initial;
  return {
    get(): Promise<string | null> {
      return Promise.resolve(value);
    },
    set(token: string): Promise<void> {
      value = token;
      return Promise.resolve();
    },
    clear(): Promise<void> {
      value = null;
      return Promise.resolve();
    },
  };
}
