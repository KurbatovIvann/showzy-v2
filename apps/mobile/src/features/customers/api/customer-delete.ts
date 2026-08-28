/**
 * High-risk customer hard-delete (SHO-179). Protocol confirmation is
 * applied by `submitWithProtocolConfirmation` after the UI confirm.
 */
import type { MutationCallOptions } from "@showzy/contract";

export type CustomerDeleteTransport = {
  readonly client: {
    readonly customers: {
      readonly deleteCustomer: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<{ id: string }>;
    };
  };
};

export function bindCustomerDeleteMutate(client: CustomerDeleteTransport) {
  return (
    input: { id: string },
    options: MutationCallOptions,
  ): Promise<{ id: string }> => {
    return client.client.customers.deleteCustomer(input, options);
  };
}
