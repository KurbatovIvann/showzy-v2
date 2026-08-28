/**
 * High-risk price-list hard-delete (SHO-189). Protocol confirmation is
 * applied by `submitWithProtocolConfirmation` after the UI confirm.
 */
import type { MutationCallOptions } from "@showzy/contract";

export type PriceListDeleteTransport = {
  readonly client: {
    readonly pricing: {
      readonly deletePriceList: (
        input: { id: string },
        options: MutationCallOptions,
      ) => Promise<{ id: string }>;
    };
  };
};

export function bindPriceListDeleteMutate(client: PriceListDeleteTransport) {
  return (
    input: { id: string },
    options: MutationCallOptions,
  ): Promise<{ id: string }> => {
    return client.client.pricing.deletePriceList(input, options);
  };
}
