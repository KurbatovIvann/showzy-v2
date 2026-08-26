/**
 * Product form save workflow (SHO-159). RHF owns field state; this loop
 * still plans writes with `planProductFormSave` / `applyWriteSuccess`,
 * then `photos.flush()`. Not `handleSubmit` as the only write.
 */
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../../api/errors";
import {
  applyWriteSuccess,
  compactDraft,
  planProductFormSave,
  PRODUCT_FORM_MAX_VARIANTS,
  snapshotFromDraft,
  type ProductFormDraft,
  type ProductFormFieldErrors,
  type ProductFormMode,
  type ProductFormMutationResult,
  type ProductFormSnapshot,
  type ProductFormWrite,
} from "./product-form-model";

export type LastWriteFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

export const NO_SAVE_FAILURE: LastWriteFailure = { kind: null, wire: null };

export type ProductFormSavePorts = {
  readonly getDraft: () => ProductFormDraft;
  readonly getMode: () => ProductFormMode;
  readonly getProductId: () => string | null;
  readonly setProductId: (productId: string) => void;
  readonly getBaseline: () => ProductFormSnapshot | null;
  readonly setDraft: (draft: ProductFormDraft) => void;
  readonly setBaseline: (baseline: ProductFormSnapshot | null) => void;
  readonly setOrigin: (draft: ProductFormDraft) => void;
  readonly getLastWrite: () => ProductFormWrite | null;
  readonly setLastWrite: (write: ProductFormWrite) => void;
  readonly getLastFailure: () => LastWriteFailure;
  readonly setLastFailure: (failure: LastWriteFailure) => void;
  readonly setClientErrors: (errors: ProductFormFieldErrors) => void;
  readonly setTooManyVariants: () => void;
  readonly submit: (
    write: ProductFormWrite,
  ) => Promise<ProductFormMutationResult>;
  readonly retry: () => Promise<ProductFormMutationResult>;
  readonly resetMutation: () => void;
  readonly bindProductId: (productId: string) => void;
  readonly flushPhotos: () => Promise<"ok" | "commit-failed">;
  readonly finish: () => Promise<void>;
};

export async function runProductFormSave(
  ports: ProductFormSavePorts,
): Promise<void> {
  for (;;) {
    const compacted = compactDraft(ports.getDraft());
    if (compacted.variants.length > PRODUCT_FORM_MAX_VARIANTS) {
      ports.setTooManyVariants();
      return;
    }
    const mode = ports.getMode();
    const productId = ports.getProductId();
    const plan = planProductFormSave({
      mode: productId !== null && mode === "create" ? "edit" : mode,
      productId,
      draft: ports.getDraft(),
      baseline: ports.getBaseline(),
      lastWrite: ports.getLastWrite(),
      lastFailureKind: ports.getLastFailure().kind,
      lastWireCode: ports.getLastFailure().wire,
    });
    if (plan.kind === "invalid") {
      ports.setClientErrors(plan.errors);
      return;
    }
    if (plan.kind === "noop") {
      ports.setOrigin(ports.getDraft());
      const photoResult = await ports.flushPhotos();
      if (photoResult === "commit-failed") {
        return;
      }
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
    if (write.kind === "createProduct" && result.kind === "product") {
      ports.setProductId(result.productId);
      ports.bindProductId(result.productId);
    }
    const applied = applyWriteSuccess({
      draft: ports.getDraft(),
      baseline: ports.getBaseline(),
      write,
      result,
    });
    const nextBaseline =
      write.kind === "createProduct"
        ? (snapshotFromDraft(compactDraft(applied.draft)) ?? applied.baseline)
        : applied.baseline;
    ports.setDraft(applied.draft);
    ports.setOrigin(applied.draft);
    ports.setBaseline(nextBaseline);
    ports.resetMutation();
    if (applied.done) {
      const photoResult = await ports.flushPhotos();
      if (photoResult === "commit-failed") {
        return;
      }
      await ports.finish();
      return;
    }
  }
}
