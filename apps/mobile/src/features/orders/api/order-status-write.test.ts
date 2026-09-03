import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import { GET_ORDER_ACTION } from "./order-detail-query";
import { LIST_ORDERS_ACTION } from "./order.queries";
import {
  bindOrderStatusMutate,
  invalidateOrdersAfterStatusWrite,
  type OrderStatusWrite,
} from "./order-status-write";
import { ordersWriteInvalidationKeys } from "./order-cache";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

describe("bindOrderStatusMutate", () => {
  it("routes confirm/start/complete/cancel to matching actions with distinct attempts", async () => {
    const calls: Array<{
      readonly method: string;
      readonly orderId: string;
      readonly key: string;
    }> = [];
    const mutate = bindOrderStatusMutate({
      client: {
        orders: {
          confirm: (input, options: MutationCallOptions) => {
            calls.push({
              method: "confirm",
              orderId: input.orderId,
              key: options.context.idempotencyKey,
            });
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "confirmed",
              confirmedAt: "2026-08-29T12:00:00.000Z",
            });
          },
          start: (input, options: MutationCallOptions) => {
            calls.push({
              method: "start",
              orderId: input.orderId,
              key: options.context.idempotencyKey,
            });
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "in_progress",
            });
          },
          complete: (input, options: MutationCallOptions) => {
            calls.push({
              method: "complete",
              orderId: input.orderId,
              key: options.context.idempotencyKey,
            });
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "done",
            });
          },
          cancel: (input, options: MutationCallOptions) => {
            calls.push({
              method: "cancel",
              orderId: input.orderId,
              key: options.context.idempotencyKey,
            });
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "canceled",
            });
          },
        },
      },
    });
    const confirm = createContractMutationController<OrderStatusWrite, unknown>(
      { mutate },
    );
    const start = createContractMutationController<OrderStatusWrite, unknown>({
      mutate,
    });
    const complete = createContractMutationController<
      OrderStatusWrite,
      unknown
    >({ mutate });
    const cancel = createContractMutationController<OrderStatusWrite, unknown>({
      mutate,
    });

    await confirm.submit({ kind: "confirm", orderId: ORDER_ID });
    await start.submit({ kind: "start", orderId: ORDER_ID });
    await complete.submit({ kind: "complete", orderId: ORDER_ID });
    await cancel.submit({ kind: "cancel", orderId: ORDER_ID });

    expect(calls).toHaveLength(4);
    expect(calls.map((call) => call.method)).toEqual([
      "confirm",
      "start",
      "complete",
      "cancel",
    ]);
    expect(new Set(calls.map((call) => call.key)).size).toBe(4);
    expect(calls[0]?.orderId).toBe(ORDER_ID);
  });

  it("does not send start when a confirm attempt is retried", async () => {
    const methods: string[] = [];
    const mutate = bindOrderStatusMutate({
      client: {
        orders: {
          confirm: (input) => {
            methods.push("confirm");
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "confirmed",
              confirmedAt: "2026-08-29T12:00:00.000Z",
            });
          },
          start: (input) => {
            methods.push("start");
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "in_progress",
            });
          },
          complete: (input) => {
            methods.push("complete");
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "done",
            });
          },
          cancel: (input) => {
            methods.push("cancel");
            return Promise.resolve({
              orderId: input.orderId,
              customerId: null,
              status: "canceled",
            });
          },
        },
      },
    });
    const confirm = createContractMutationController<OrderStatusWrite, unknown>(
      { mutate },
    );
    await confirm.submit({ kind: "confirm", orderId: ORDER_ID });
    await confirm.retry();
    expect(methods).toEqual(["confirm", "confirm"]);
  });
});

describe("ordersWriteInvalidationKeys", () => {
  it("targets orders.get and orders.list for the active company only", () => {
    expect(ordersWriteInvalidationKeys("company-a")).toEqual([
      [GET_ORDER_ACTION, "company-a"],
      [LIST_ORDERS_ACTION, "company-a"],
    ]);
  });

  it("invalidates after a successful write without touching other companies", async () => {
    const queryClient = createShowzyQueryClient();
    const getKey = contractQueryKey(GET_ORDER_ACTION, "company-a", {
      orderId: ORDER_ID,
    });
    const listKey = contractQueryKey(LIST_ORDERS_ACTION, "company-a", {
      kind: "page.summary",
    });
    const otherKey = contractQueryKey(GET_ORDER_ACTION, "company-b", {
      orderId: ORDER_ID,
    });
    queryClient.setQueryData(getKey, { orderId: ORDER_ID });
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(otherKey, { orderId: ORDER_ID });

    await invalidateOrdersAfterStatusWrite({
      queryClient,
      companyId: "company-a",
    });

    expect(queryClient.getQueryState(getKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);

    await invalidateOrdersAfterStatusWrite({
      queryClient,
      companyId: null,
    });
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
