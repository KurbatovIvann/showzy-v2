/**
 * Hermes on this Expo runtime can expose `crypto` whose `randomUUID` /
 * `getRandomValues` both throw. Mutations then fail before fetch with a
 * TypeError that screens map to a network banner.
 */

export type WebCryptoSource = {
  readonly randomUUID: () => string;
  readonly getRandomValues: (bytes: Uint8Array) => Uint8Array;
};

export function webCryptoCanMintAttemptKey(): boolean {
  try {
    const key = globalThis.crypto.randomUUID();
    return typeof key === "string" && key.length > 0;
  } catch {
    try {
      globalThis.crypto.getRandomValues(new Uint8Array(16));
      return true;
    } catch {
      return false;
    }
  }
}

export function installWebCryptoPolyfill(source: WebCryptoSource): void {
  if (webCryptoCanMintAttemptKey()) {
    return;
  }
  const polyfill = {
    randomUUID: source.randomUUID,
    getRandomValues: (bytes: Uint8Array) => source.getRandomValues(bytes),
  };
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    writable: true,
    value: polyfill,
  });
}
