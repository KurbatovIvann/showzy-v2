/**
 * High-risk counterparty hard-delete (SHO-195). Permission is
 * `customers:edit` (copy `deleteGroup`, not `deleteCustomer`). Protocol
 * confirmation is applied by `submitWithProtocolConfirmation`.
 */
import type { MutationCallOptions } from "@showzy/contract";

export type CounterpartyDeleteTransport = {
  readonly client: {
    readonly customers: {
      readonly deleteCounterparty: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<{ id: string }>;
    };
  };
};

export function bindCounterpartyDeleteMutate(
  client: CounterpartyDeleteTransport,
) {
  return (
    input: { id: string },
    options: MutationCallOptions,
  ): Promise<{ id: string }> => {
    return client.client.customers.deleteCounterparty(input, options);
  };
}
