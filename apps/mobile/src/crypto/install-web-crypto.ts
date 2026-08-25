import { getRandomValues as fillRandomBytes, randomUUID } from "expo-crypto";

import { installWebCryptoPolyfill } from "./web-crypto-polyfill";

installWebCryptoPolyfill({
  randomUUID,
  getRandomValues: (bytes) => fillRandomBytes(bytes),
});
