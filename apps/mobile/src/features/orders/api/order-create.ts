/**
 * `orders.create` write binder (SHO-213). One `useContractMutation`
 * attempt per submit. UI drafts never go on the wire: payloads are typed
 * from `ContractClient` and parsed with the action schema.
 */
import {
  contractModules,
  wireErrorStatus,
  type MutationCallOptions,
} from "@showzy/contract";

import type { QueryClient } from "@tanstack/react-query";

import type {
  CreateOrderPayload,
  CreateOrderResult,
  OrderFormWrite,
} from "../form/order-form-plan";
import { invalidateOrdersAfterStatusWrite } from "./order-status-write";

export type OrderCreateTransport = {
  readonly client: {
    readonly orders: {
      readonly create: (
        input: CreateOrderPayload,
        options: MutationCallOptions,
      ) => Promise<CreateOrderResult>;
    };
  };
};

function wireValidationFromIssues(
  issues: ReadonlyArray<{
    readonly code: string;
    readonly path: ReadonlyArray<PropertyKey>;
    readonly message: string;
  }>,
): Error {
  return Object.assign(new Error("Validation failed"), {
    code: "VALIDATION" as const,
    status: wireErrorStatus.VALIDATION,
    data: {
      issues: issues.map((issue) => ({
        code: issue.code,
        path: issue.path.filter(
          (part): part is string | number =>
            typeof part === "string" || typeof part === "number",
        ),
        message: issue.message,
      })),
    },
  });
}

function parseCreateOrder(input: CreateOrderPayload): CreateOrderPayload {
  const parsed = contractModules.orders.create.input.safeParse(input);
  if (!parsed.success) {
    throw wireValidationFromIssues(parsed.error.issues);
  }
  return input;
}

export function bindOrderCreateMutate(client: OrderCreateTransport) {
  return (
    input: OrderFormWrite,
    options: MutationCallOptions,
  ): Promise<CreateOrderResult> => {
    try {
      return client.client.orders.create(
        parseCreateOrder(input.input),
        options,
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new TypeError("order create write parse failed"));
    }
  };
}

export async function invalidateOrdersAfterCreate(args: {
  readonly queryClient: QueryClient;
  readonly companyId: string | null;
}): Promise<void> {
  await invalidateOrdersAfterStatusWrite(args);
}
