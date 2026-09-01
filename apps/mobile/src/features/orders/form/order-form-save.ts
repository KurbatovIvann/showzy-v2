/**
 * Order create save workflow (SHO-213 / SHO-305). Delegates to form-kit
 * `runFormSave`; `finish` still receives the created `orderId`.
 */
import {
  NO_SAVE_FAILURE,
  type LastWriteFailure,
} from "../../../components/form-kit/last-write-failure";
import { runFormSave } from "../../../components/form-kit/run-form-save";
import {
  type OrderFormDraft,
  type OrderFormFieldErrors,
} from "./order-form-draft";
import {
  parseThenPlanOrderFormSave,
  type CreateOrderResult,
  type OrderFormWrite,
} from "./order-form-plan";

export { NO_SAVE_FAILURE, type LastWriteFailure };

export type OrderFormSavePorts = {
  readonly getDraft: () => OrderFormDraft;
  readonly setOrigin: (draft: OrderFormDraft) => void;
  readonly getLastWrite: () => OrderFormWrite | null;
  readonly setLastWrite: (write: OrderFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: OrderFormFieldErrors) => void;
  readonly submit: (write: OrderFormWrite) => Promise<CreateOrderResult>;
  readonly retry: () => Promise<CreateOrderResult>;
  readonly resetMutation: () => void;
  readonly finish: (orderId: string) => Promise<void>;
};

export async function runOrderFormSave(
  ports: OrderFormSavePorts,
): Promise<void> {
  await runFormSave<
    OrderFormDraft,
    OrderFormWrite,
    CreateOrderResult,
    OrderFormFieldErrors
  >({
    plan: () =>
      parseThenPlanOrderFormSave({
        draft: ports.getDraft(),
        lastWrite: ports.getLastWrite(),
        lastFailureKind: ports.getLastFailure().kind,
        lastWireCode: ports.getLastFailure().wire,
      }),
    getDraft: ports.getDraft,
    setOrigin: ports.setOrigin,
    getLastWrite: ports.getLastWrite,
    setLastWrite: ports.setLastWrite,
    setLastFailure: ports.setLastFailure,
    setFieldErrors: ports.setFieldErrors,
    submit: ports.submit,
    retry: ports.retry,
    resetMutation: ports.resetMutation,
    finish: async (result) => {
      if (result === null) {
        return;
      }
      await ports.finish(result.orderId);
    },
  });
}
