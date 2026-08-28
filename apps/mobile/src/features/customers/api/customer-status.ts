/**
 * Status-only customer writes (SHO-179). One binder so the list can mint
 * a single `useContractMutation` attempt per confirm. Cache invalidation
 * is post-success only — never optimistic.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import { customersWriteInvalidationKeys } from "./customer-cache";

export type CustomerStatusWrite =
  | { readonly kind: "archiveCustomer"; readonly id: string }
  | { readonly kind: "restoreCustomer"; readonly id: string };

export type CustomerStatusTransport = {
  readonly client: {
    readonly customers: {
      readonly archiveCustomer: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<unknown>;
      readonly restoreCustomer: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<unknown>;
    };
  };
};

export function bindCustomerStatusMutate(client: CustomerStatusTransport) {
  return (
    input: CustomerStatusWrite,
    options: MutationCallOptions,
  ): Promise<unknown> => {
    switch (input.kind) {
      case "archiveCustomer":
        return client.client.customers.archiveCustomer(
          { id: input.id },
          options,
        );
      case "restoreCustomer":
        return client.client.customers.restoreCustomer(
          { id: input.id },
          options,
        );
    }
  };
}

export async function invalidateCustomersAfterWrite(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  if (args.companyId === null) {
    return;
  }
  await Promise.all(
    customersWriteInvalidationKeys(args.companyId).map((queryKey) =>
      args.queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
