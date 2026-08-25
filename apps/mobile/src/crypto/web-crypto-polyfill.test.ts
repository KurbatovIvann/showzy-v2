import { afterEach, describe, expect, it } from "vitest";

import {
  installWebCryptoPolyfill,
  webCryptoCanMintAttemptKey,
} from "./web-crypto-polyfill";

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("installWebCryptoPolyfill", () => {
  const original = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: original,
    });
  });

  it("does not replace crypto when randomUUID already works", () => {
    const before = globalThis.crypto;
    installWebCryptoPolyfill({
      randomUUID: () => UUID,
      getRandomValues: (bytes) => bytes,
    });
    expect(globalThis.crypto).toBe(before);
    expect(webCryptoCanMintAttemptKey()).toBe(true);
  });

  it("installs expo-backed methods when Web Crypto throws", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: {
        randomUUID() {
          throw new TypeError("Illegal invocation");
        },
        getRandomValues() {
          throw new TypeError("Illegal invocation");
        },
      },
    });
    expect(webCryptoCanMintAttemptKey()).toBe(false);
    installWebCryptoPolyfill({
      randomUUID: () => UUID,
      getRandomValues: (bytes) => {
        bytes.fill(1);
        return bytes;
      },
    });
    expect(globalThis.crypto.randomUUID()).toBe(UUID);
    const filled = globalThis.crypto.getRandomValues(new Uint8Array(2));
    expect(Array.from(filled)).toEqual([1, 1]);
  });
});
