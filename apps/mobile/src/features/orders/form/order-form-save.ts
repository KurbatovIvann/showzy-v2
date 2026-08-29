/**
 * Order create save workflow (SHO-213). RHF `handleSubmit` /
 * `parseOrderFormUiDraft` owns the UI parse; planner `invalid` reports
 * field errors through `setFieldErrors`. Not `handleSubmit` as the only
 * write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import {
  type OrderFormDraft,
  type OrderFormFieldErrors,
} from "./order-form-draft";
import {
  parseThenPlanOrderFormSave,
  type CreateOrderResult,
  type OrderFormWrite,
} from "./order-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

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
  const plan = parseThenPlanOrderFormSave({
    draft: ports.getDraft(),
    lastWrite: ports.getLastWrite(),
    lastFailureKind: ports.getLastFailure().kind,
    lastWireCode: ports.getLastFailure().wire,
  });
  if (plan.kind === "invalid") {
    ports.setFieldErrors(plan.errors);
    return;
  }
  if (plan.kind === "write") {
    ports.setLastWrite(plan.write);
  }
  const write = ports.getLastWrite();
  if (write === null) {
    return;
  }
  const result =
    plan.kind === "retry" ? await ports.retry() : await ports.submit(write);
  ports.setLastFailure(NO_SAVE_FAILURE);
  ports.resetMutation();
  ports.setOrigin(ports.getDraft());
  await ports.finish(result.orderId);
}
