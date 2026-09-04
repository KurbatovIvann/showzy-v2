/**
 * `orders.create` binder (SHO-379). One attempt per logical submit.
 * Success invalidates **list** keys only — the create summary is not
 * `orders.get` shaped, so detail hydrates after navigate. UI wire is
 * `{ customer: { by: "id" }, items, comment? }` with milli only.
 * New source always sends explicit `variantSelection` (`base` or
 * `reference` by id) and never legacy `variant`.
 */
import type { MutationCallOptions } from "@showzy/contract";
import type { QueryClient } from "@tanstack/react-query";

import type { ShowzyClient } from "../../../api/client";
import { ordersListCacheKey } from "./order-cache";

type OrdersCreateFn = ShowzyClient["client"]["orders"]["create"];
type OrdersCreateInput = Parameters<OrdersCreateFn>[0];

export type CreateOrderVariantSelection =
  | { readonly kind: "base" }
  | {
      readonly kind: "reference";
      readonly ref: { readonly by: "id"; readonly id: string };
    };

export type CreateOrderPayload = {
  readonly customer: { readonly by: "id"; readonly id: string };
  readonly items: ReadonlyArray<{
    readonly product: { readonly by: "id"; readonly id: string };
    readonly variantSelection: CreateOrderVariantSelection;
    readonly quantity: { readonly milli: string };
  }>;
  readonly comment?: string;
};

export type CreateOrderResult = Awaited<ReturnType<OrdersCreateFn>>;

export type OrderCreateTransport = {
  readonly client: {
    readonly orders: {
      readonly create: (
        input: OrdersCreateInput,
        options: MutationCallOptions,
      ) => Promise<CreateOrderResult>;
    };
  };
};

function toCreateInput(input: CreateOrderPayload): OrdersCreateInput {
  const items: OrdersCreateInput["items"] = [];
  for (const item of input.items) {
    items.push({
      product: item.product,
      variantSelection: item.variantSelection,
      quantity: item.quantity,
    });
  }
  if (input.comment === undefined) {
    return { customer: input.customer, items };
  }
  return { customer: input.customer, items, comment: input.comment };
}

export function bindOrderCreateMutate(client: OrderCreateTransport) {
  return (
    input: CreateOrderPayload,
    options: MutationCallOptions,
  ): Promise<CreateOrderResult> =>
    client.client.orders.create(toCreateInput(input), options);
}

export function applyOrderCreateSuccess(
  queryClient: QueryClient,
  companyId: string | null,
): void {
  if (companyId === null) {
    return;
  }
  void queryClient.invalidateQueries({
    queryKey: ordersListCacheKey(companyId),
  });
}
