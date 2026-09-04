import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createWebQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import { GET_ORDER_ACTION } from "./get";
import { LIST_ORDERS_ACTION } from "./list";
import {
  applyOrderCreateSuccess,
  bindOrderCreateMutate,
  type CreateOrderPayload,
  type CreateOrderResult,
} from "./create";

const CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORDER_ID = "99999999-9999-4999-8999-999999999999";

const INPUT: CreateOrderPayload = {
  customer: { by: "id", id: CUSTOMER_ID },
  items: [
    {
      product: { by: "id", id: PRODUCT_ID },
      variantSelection: { kind: "base" },
      quantity: { milli: "1000" },
    },
  ],
};

const RESULT: CreateOrderResult = {
  orderId: ORDER_ID,
  orderNumber: "KL-NEW01",
  customer: { nameSnapshot: "Анна Мельник", linkedCustomerId: CUSTOMER_ID },
  status: "new",
  itemCount: 1,
  totalNetMinor: "0",
  totalTaxMinor: "0",
  totalGrossMinor: "0",
  currency: "UAH",
  createdAt: "2026-09-03T12:00:00.000Z",
};

describe("bindOrderCreateMutate", () => {
  it("calls orders.create with id+milli only and reuses the attempt on retry", async () => {
    const calls: Array<{
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const controller = createContractMutationController<
      CreateOrderPayload,
      CreateOrderResult
    >({
      mutate: bindOrderCreateMutate({
        client: {
          orders: {
            create: (input, options: MutationCallOptions) => {
              calls.push({
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.reject(new TypeError("Failed to fetch"));
            },
          },
        },
      }),
    });

    await controller.submit(INPUT).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.input).toEqual(INPUT);
    expect(Object.keys(calls[0]?.input ?? {}).sort()).toEqual([
      "customer",
      "items",
    ]);
    expect(
      Object.keys(
        (calls[0]?.input as CreateOrderPayload | undefined)?.items[0] ?? {},
      ).sort(),
    ).toEqual(["product", "quantity", "variantSelection"]);
    expect(
      (calls[0]?.input as CreateOrderPayload | undefined)?.items[0],
    ).not.toHaveProperty("variant");
    expect(JSON.stringify(calls[0]?.input)).not.toContain('by":"query');
    expect(JSON.stringify(calls[0]?.input)).not.toContain("decimal");
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });
});

describe("applyOrderCreateSuccess", () => {
  it("invalidates only orders.list keys for the active company", () => {
    const queryClient = createWebQueryClient();
    const listKey = contractQueryKey(LIST_ORDERS_ACTION, "company-a", {
      kind: "page.summary",
    });
    const getKey = contractQueryKey(GET_ORDER_ACTION, "company-a", {
      orderId: ORDER_ID,
    });
    const otherList = contractQueryKey(LIST_ORDERS_ACTION, "company-b", {
      kind: "page.summary",
    });
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(getKey, RESULT);
    queryClient.setQueryData(otherList, { items: [] });

    applyOrderCreateSuccess(queryClient, "company-a");

    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(getKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(otherList)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
