import { createMutationAttempt, type MutationAttempt } from "@showzy/contract";

/** Tests and web: Node/browser Web Crypto is enough. */
export function createMobileMutationAttempt(): MutationAttempt {
  return createMutationAttempt();
}
