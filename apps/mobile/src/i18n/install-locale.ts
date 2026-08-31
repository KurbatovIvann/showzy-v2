/**
 * Side-effect: resolve the device locale once at app start, before the
 * router mounts. Import from `index.ts` and the root layout the same way
 * Unistyles is bootstrapped. Tests must not import this file.
 */
import { initAppLocale } from "./device-locale";

initAppLocale();
