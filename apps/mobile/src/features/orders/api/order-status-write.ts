/**
 * Status-only order writes (SHO-212). Confirm and cancel are distinct
 * actions so a failed confirm does not retry as cancel. Cache
 * invalidation is post-success only — never optimistic. Source of truth
 * stays the order domain (`orders.get`), not chat or any projection.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import { ordersWriteInvalidationKeys } from "./order-cache";

export type OrderStatusWrite =
  | { readonly kind: "confirm"; readonly orderId: string }
  | { readonly kind: "cancel"; readonly orderId: string };

export type OrderStatusTransport = {
  readonly client: {
    readonly orders: {
      readonly confirm: (
        input: { orderId: string },
        options: MutationCallOptions,
      ) => Promise<{
        orderId: string;
        customerId: string | null;
        status: "confirmed";
        confirmedAt: string;
      }>;
      readonly cancel: (
        input: { orderId: string },
        options: MutationCallOptions,
      ) => Promise<{
        orderId: string;
        customerId: string | null;
        status: "canceled";
      }>;
    };
  };
};

export function bindOrderStatusMutate(client: OrderStatusTransport) {
  return (
    input: OrderStatusWrite,
    options: MutationCallOptions,
  ): Promise<unknown> => {
    switch (input.kind) {
      case "confirm":
        return client.client.orders.confirm(
          { orderId: input.orderId },
          options,
        );
      case "cancel":
        return client.client.orders.cancel({ orderId: input.orderId }, options);
    }
  };
}

export async function invalidateOrdersAfterStatusWrite(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  if (args.companyId === null) {
    return;
  }
  await Promise.all(
    ordersWriteInvalidationKeys(args.companyId).map((queryKey) =>
      args.queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
