/**
 * Shared `apiRef` + null-client rejection + double-submit busy guard
 * (SHO-297). Feature tickets adopt this; this module lands the helper
 * plus one catalog example.
 */
import type { MutationCallOptions } from "@showzy/contract";
import { useRef } from "react";

import { useApiClient } from "./api-provider";
import type { ContractClient } from "./client";
import { useContractMutation } from "./contract-mutation";
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
    async run<T>(fn, isPending = false) {
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

export function useBoundContractMutation<TInput, TOutput>(
  bind: (
    client: ContractClient,
  ) => (input: TInput, options: MutationCallOptions) => Promise<TOutput>,
) {
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const guardRef = useRef(createMutationBusyGuard());
  const mutation = useContractMutation(
    boundContractMutate(() => apiRef.current, bind),
  );
  return {
    ...mutation,
    apiClient,
    runGuarded: <T>(fn: () => Promise<T>) =>
      guardRef.current.run(fn, mutation.isPending),
  };
}
