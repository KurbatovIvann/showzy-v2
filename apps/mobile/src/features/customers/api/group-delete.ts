/**
 * High-risk group hard-delete (SHO-179). Permission is `customers:edit`.
 * Protocol confirmation is applied by `submitWithProtocolConfirmation`.
 */
import type { MutationCallOptions } from "@showzy/contract";

export type GroupDeleteTransport = {
  readonly client: {
    readonly customers: {
      readonly deleteGroup: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<{ id: string }>;
    };
  };
};

export function bindGroupDeleteMutate(client: GroupDeleteTransport) {
  return (
    input: { id: string },
    options: MutationCallOptions,
  ): Promise<{ id: string }> => {
    return client.client.customers.deleteGroup(input, options);
  };
}
