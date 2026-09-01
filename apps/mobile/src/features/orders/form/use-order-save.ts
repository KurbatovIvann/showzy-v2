/**
 * Order create save hook (SHO-305). Single `orders.create` write — the
 * form-kit `useFormSave` / `runFormSave` loop fits (unlike price-list
 * multi-write).
 */
import { useQueryClient } from "@tanstack/react-query";

import { useActiveCompany } from "../../../api/query-provider";
import { useFormSave } from "../../../components/form-kit";
import {
  bindOrderCreateMutate,
  invalidateOrdersAfterCreate,
} from "../api/order-create";
import type { OrderFormDraft, OrderFormFieldErrors } from "./order-form-draft";
import type { OrderFormLoadState } from "./order-form-load";
import {
  parseThenPlanOrderFormSave,
  type CreateOrderResult,
  type OrderFormWrite,
} from "./order-form-plan";

export function useOrderSave(args: {
  readonly loadKind: OrderFormLoadState["kind"];
  readonly getDraft: () => OrderFormDraft;
  readonly setOrigin: (draft: OrderFormDraft) => void;
  readonly onSaved: (orderId: string) => Promise<void>;
  readonly setFieldErrors: (errors: OrderFormFieldErrors) => void;
}): {
  readonly save: () => Promise<void>;
  readonly pending: boolean;
  readonly lastWrite: OrderFormWrite | null;
  readonly mutationError: unknown;
  readonly isMutationError: boolean;
  readonly resetMutation: () => void;
} {
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useFormSave<
    OrderFormDraft,
    OrderFormWrite,
    CreateOrderResult,
    OrderFormFieldErrors
  >({
    bindMutate: bindOrderCreateMutate,
    invalidate: () =>
      invalidateOrdersAfterCreate({
        queryClient,
        companyId: activeCompanyId,
      }),
    ready: args.loadKind === "ready",
    getDraft: args.getDraft,
    setOrigin: args.setOrigin,
    setFieldErrors: args.setFieldErrors,
    plan: ({ lastWrite, lastFailure }) =>
      parseThenPlanOrderFormSave({
        draft: args.getDraft(),
        lastWrite,
        lastFailureKind: lastFailure.kind,
        lastWireCode: lastFailure.wire,
      }),
    onSaved: async (result) => {
      if (result === null) {
        return;
      }
      await args.onSaved(result.orderId);
    },
  });
}
