import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { createShowzyQueryClient } from "../../../api/query-client";
import { contractQueryKey } from "../../../api/query-options";
import type {
  CreateOrderResult,
  OrderFormWrite,
} from "../form/order-form-plan";
import { GET_ORDER_ACTION } from "./order-detail-query";
import { LIST_ORDERS_ACTION } from "./order.queries";
import {
  bindOrderCreateMutate,
  invalidateOrdersAfterCreate,
} from "./order-create";

const ORDER_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

function createdOrder(): CreateOrderResult {
  return {
    orderId: ORDER_ID,
    orderNumber: 1,
    customerId: CUSTOMER_ID,
    status: "new",
    comment: null,
    totalNetMinor: "1000",
    totalTaxMinor: "0",
    totalGrossMinor: "1000",
    currency: "UAH",
    confirmedAt: null,
    createdAt: "2026-08-29T12:00:00.000Z",
    items: [
      {
        itemId: "22222222-2222-4222-8222-222222222222",
        productId: PRODUCT_ID,
        variantId: null,
        titleSnapshot: "Торт",
        quantityMilli: "1000",
        unitPriceMinor: "1000",
        discountKind: "none",
        discountValue: "0",
        discountAmountMinor: "0",
        taxTreatment: "exempt",
        taxRateBp: 0,
        taxAmountMinor: "0",
        netAmountMinor: "1000",
        grossAmountMinor: "1000",
        currency: "UAH",
        priceSource: "base",
        personalPriceId: null,
        priceListId: null,
        priceListEntryId: null,
        resolverVersion: 1,
      },
    ],
  };
}

describe("bindOrderCreateMutate", () => {
  it("calls orders.create with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const write: OrderFormWrite = {
      kind: "createOrder",
      input: {
        customerId: CUSTOMER_ID,
        items: [{ productId: PRODUCT_ID, quantityMilli: "1000" }],
      },
    };
    const controller = createContractMutationController({
      mutate: bindOrderCreateMutate({
        client: {
          orders: {
            create: (input, options: MutationCallOptions) => {
              calls.push({
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.resolve(createdOrder());
            },
          },
        },
      }),
    });

    await controller.submit(write);
    await controller.retry();

    expect(calls).toHaveLength(2);
    expect(calls[0]?.input).toEqual(write.input);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
    expect(JSON.stringify(calls[0]?.input)).not.toContain("basePrice");
    expect(JSON.stringify(calls[0]?.input)).not.toContain("payment");
    expect(JSON.stringify(calls[0]?.input)).not.toContain("delivery");
  });
});

describe("invalidateOrdersAfterCreate", () => {
  it("invalidates list and get for the active company only", async () => {
    const queryClient = createShowzyQueryClient();
    const getKey = contractQueryKey(GET_ORDER_ACTION, "company-a", {
      orderId: ORDER_ID,
    });
    const listKey = contractQueryKey(LIST_ORDERS_ACTION, "company-a", {
      status: "all",
    });
    const otherKey = contractQueryKey(GET_ORDER_ACTION, "company-b", {
      orderId: ORDER_ID,
    });
    queryClient.setQueryData(getKey, { orderId: ORDER_ID });
    queryClient.setQueryData(listKey, { items: [] });
    queryClient.setQueryData(otherKey, { orderId: ORDER_ID });

    await invalidateOrdersAfterCreate({
      queryClient,
      companyId: "company-a",
    });

    expect(queryClient.getQueryState(getKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
