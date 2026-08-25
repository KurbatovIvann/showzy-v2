import { randomUUID } from "expo-crypto";
import { createMutationAttempt, type MutationAttempt } from "@showzy/contract";

/**
 * Device Hermes Web Crypto is unusable (both `randomUUID` and
 * `getRandomValues` throw). Native `expo-crypto` is already in the kit.
 */
export function createMobileMutationAttempt(): MutationAttempt {
  return createMutationAttempt(() => randomUUID());
}
