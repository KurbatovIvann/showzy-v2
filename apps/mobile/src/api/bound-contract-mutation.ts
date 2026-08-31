/**
 * Shared `apiRef` + null-client rejection + double-submit busy guard
 * (SHO-297). Feature tickets adopt this; this module lands the helper
 * plus one catalog example. Keep this file free of React Native so
 * Vitest can import the helpers without the Expo runtime.
 */
import type { MutationCallOptions } from "@showzy/contract";

import { ClientUnavailableError } from "./errors";

export function boundContractMutate<TClient, TInput, TOutput>(
  getClient: () => TClient | null,
  bind: (
    client: TClient,
  ) => (input: TInput, options: MutationCallOptions) => Promise<TOutput>,
): (input: TInput, options: MutationCallOptions) => Promise<TOutput> {
  return (input, options) => {
    const client = getClient();
    if (client === null) {
      return Promise.reject(new ClientUnavailableError());
    }
    return bind(client)(input, options);
  };
}

export function createMutationBusyGuard(): {
  readonly run: <T>(
    fn: () => Promise<T>,
    isPending?: boolean,
  ) => Promise<T | undefined>;
} {
  let busy = false;
  return {
    async run<T>(
      fn: () => Promise<T>,
      isPending = false,
    ): Promise<T | undefined> {
      if (busy || isPending) {
        return undefined;
      }
      busy = true;
      try {
        return await fn();
      } finally {
        busy = false;
      }
    },
  };
}
