/**
 * Status-only order writes (SHO-378). Confirm, start, complete, and
 * cancel are distinct actions so a failed confirm does not retry as
 * start. Cache invalidation is post-success only — never optimistic.
 * `CONFIRMATION_REQUIRED` is not on these contracts.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import { ordersWriteInvalidationKeys } from "./order-cache";

export type OrderStatusWrite =
  | { readonly kind: "confirm"; readonly orderId: string }
  | { readonly kind: "start"; readonly orderId: string }
  | { readonly kind: "complete"; readonly orderId: string }
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
      readonly start: (
        input: { orderId: string },
        options: MutationCallOptions,
      ) => Promise<{
        orderId: string;
        customerId: string | null;
        status: "in_progress";
      }>;
      readonly complete: (
        input: { orderId: string },
        options: MutationCallOptions,
      ) => Promise<{
        orderId: string;
        customerId: string | null;
        status: "done";
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
      case "start":
        return client.client.orders.start({ orderId: input.orderId }, options);
      case "complete":
        return client.client.orders.complete(
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
