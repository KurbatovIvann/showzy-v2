/**
 * Price-list form save workflow (SHO-190). RHF `handleSubmit` /
 * `parsePriceListFormUiDraft` owns the UI parse; planner `invalid`
 * reports field errors through `setFieldErrors`. Create stamps the list
 * id then finishes so the hook can replace to the editor. Edit loops
 * remaining name / status / entry writes. Not `handleSubmit` as the
 * only write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import {
  type PriceListFormDraft,
  type PriceListFormFieldErrors,
  type PriceListFormMode,
  type PriceListFormSnapshot,
} from "./price-list-form-draft";
import {
  applyWriteSuccess,
  parseThenPlanPriceListFormSave,
  type PriceListFormMutationResult,
  type PriceListFormWrite,
} from "./price-list-form-plan";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

export type PriceListFormSavePorts = {
  readonly getDraft: () => PriceListFormDraft;
  readonly getMode: () => PriceListFormMode;
  readonly getPriceListId: () => string | null;
  readonly setPriceListId: (priceListId: string) => void;
  readonly getBaseline: () => PriceListFormSnapshot | null;
  readonly setDraft: (draft: PriceListFormDraft) => void;
  readonly setBaseline: (baseline: PriceListFormSnapshot | null) => void;
  readonly setOrigin: (draft: PriceListFormDraft) => void;
  readonly getLastWrite: () => PriceListFormWrite | null;
  readonly setLastWrite: (write: PriceListFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setFieldErrors: (errors: PriceListFormFieldErrors) => void;
  readonly submit: (
    write: PriceListFormWrite,
  ) => Promise<PriceListFormMutationResult>;
  readonly retry: () => Promise<PriceListFormMutationResult>;
  readonly resetMutation: () => void;
  readonly finish: () => Promise<void>;
};

export async function runPriceListFormSave(
  ports: PriceListFormSavePorts,
): Promise<void> {
  for (;;) {
    const mode = ports.getMode();
    const priceListId = ports.getPriceListId();
    const plan = parseThenPlanPriceListFormSave({
      mode: priceListId !== null && mode === "create" ? "edit" : mode,
      priceListId,
      draft: ports.getDraft(),
      baseline: ports.getBaseline(),
      lastWrite: ports.getLastWrite(),
      lastFailureKind: ports.getLastFailure().kind,
      lastWireCode: ports.getLastFailure().wire,
    });
    if (plan.kind === "invalid") {
      ports.setFieldErrors(plan.errors);
      return;
    }
    if (plan.kind === "noop") {
      ports.setOrigin(ports.getDraft());
      await ports.finish();
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
    if (write.kind === "createPriceList") {
      ports.setPriceListId(result.id);
    }
    const applied = applyWriteSuccess({
      draft: ports.getDraft(),
      baseline: ports.getBaseline(),
      write,
    });
    const nextId = ports.getPriceListId() ?? applied.priceListId;
    ports.setDraft(applied.draft);
    ports.setBaseline(applied.baseline);
    ports.resetMutation();
    if (applied.done || write.kind === "createPriceList") {
      ports.setOrigin(ports.getDraft());
      await ports.finish();
      return;
    }
    if (nextId === null) {
      return;
    }
  }
}
