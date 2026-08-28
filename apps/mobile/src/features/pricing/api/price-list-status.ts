/**
 * Default / active status writes (SHO-189). One binder so the list can
 * mint a single `useContractMutation` attempt per confirm. Cache
 * invalidation is post-success only — never optimistic.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import { priceListsWriteInvalidationKeys } from "./price-list-cache";

export type PriceListStatusWrite =
  | { readonly kind: "setDefault"; readonly priceListId: string }
  | { readonly kind: "clearDefault" }
  | { readonly kind: "activate"; readonly id: string }
  | { readonly kind: "deactivate"; readonly id: string };

export type PriceListStatusTransport = {
  readonly client: {
    readonly pricing: {
      readonly setDefaultPriceList: (
        input: { priceListId: string | null },
        options: MutationCallOptions,
      ) => Promise<unknown>;
      readonly activatePriceList: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<unknown>;
      readonly deactivatePriceList: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<unknown>;
    };
  };
};

export function bindPriceListStatusMutate(client: PriceListStatusTransport) {
  return (
    input: PriceListStatusWrite,
    options: MutationCallOptions,
  ): Promise<unknown> => {
    switch (input.kind) {
      case "setDefault":
        return client.client.pricing.setDefaultPriceList(
          { priceListId: input.priceListId },
          options,
        );
      case "clearDefault":
        return client.client.pricing.setDefaultPriceList(
          { priceListId: null },
          options,
        );
      case "activate":
        return client.client.pricing.activatePriceList(
          { id: input.id },
          options,
        );
      case "deactivate":
        return client.client.pricing.deactivatePriceList(
          { id: input.id },
          options,
        );
    }
  };
}

export async function invalidatePriceListsAfterWrite(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  if (args.companyId === null) {
    return;
  }
  await Promise.all(
    priceListsWriteInvalidationKeys(args.companyId).map((queryKey) =>
      args.queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
