/**
 * React binding for `boundContractMutate` + the double-submit guard.
 * Import the hook from here so helper tests stay Expo-runtime-free.
 */
import type { MutationCallOptions } from "@showzy/contract";
import { useRef } from "react";

import { useApiClient } from "./api-provider";
import {
  boundContractMutate,
  createMutationBusyGuard,
} from "./bound-contract-mutation";
import type { ContractClient } from "./client";
import { useContractMutation } from "./contract-mutation";

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
