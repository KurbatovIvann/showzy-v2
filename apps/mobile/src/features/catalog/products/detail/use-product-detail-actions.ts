/**
 * Product archive/restore + navigation, and the shared status-write
 * used by variant archive/restore (one mutation so a failed confirm
 * retries the in-flight attempt — SHO-138 / SHO-160).
 */
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useBoundContractMutation } from "../../../../api/bound-contract-mutation";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { presentConfirmDialog } from "../../../../components/ui/present-confirm-dialog";
import { waitForSheetHidden } from "../../../../components/ui/sheet-dismiss";
import type { ProductsDetailCopy } from "../../../../i18n/products";
import {
  bindCatalogStatusMutate,
  invalidateCatalogAfterStatusWrite,
} from "../api/product-archive";
import { productEditorHref } from "../shared/product-hrefs";
import {
  confirmIsDestructive,
  confirmSheetCopy,
  mapStatusWriteFailure,
  planConfirmStatusWrite,
  resultForProductSheetAction,
  statusWriteBanner,
  statusWriteForConfirm,
  type ConfirmTarget,
  type ProductDetailViewModel,
  type ProductSheetActionId,
} from "./product-detail-model";
import type { ProductDetailSheetAction } from "./product-detail.reducer";

export type DetailStatusWrite = {
  readonly banner: string | null;
  readonly promptConfirm: (args: {
    readonly target: ConfirmTarget;
    readonly variantActionId: string | null;
    readonly waitHidden: () => Promise<void>;
  }) => Promise<void>;
};

export function useSheetHiddenWaiter(): {
  readonly notify: () => void;
  readonly wait: () => Promise<void>;
} {
  const waitersRef = useRef<Array<() => void>>([]);
  return {
    notify: () => {
      const waiters = waitersRef.current;
      waitersRef.current = [];
      for (const waiter of waiters) {
        waiter();
      }
    },
    wait: () =>
      waitForSheetHidden(
        new Promise<void>((resolve) => {
          waitersRef.current.push(resolve);
        }),
      ),
  };
}

export function useDetailStatusWrite(args: {
  readonly productId: string | null;
  readonly copy: ProductsDetailCopy;
  readonly dispatch: (action: ProductDetailSheetAction) => void;
}): DetailStatusWrite {
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const mutation = useBoundContractMutation((client) =>
    bindCatalogStatusMutate(client),
  );
  const mutationFailure = mutation.isError
    ? describeQueryFailure(mutation.error).kind
    : null;

  async function submitConfirm(target: ConfirmTarget): Promise<void> {
    if (args.productId === null) {
      return;
    }
    const productId = args.productId;
    await mutation.runGuarded(async () => {
      try {
        if (planConfirmStatusWrite(mutation.isError) === "retry") {
          await mutation.retry();
        } else {
          await mutation.submit(statusWriteForConfirm(target, productId));
        }
        await invalidateCatalogAfterStatusWrite({
          queryClient,
          companyId: activeCompanyId,
        });
        args.dispatch({ type: "closeAll" });
        mutation.reset();
      } catch {
        // Banner is derived from mutation.error.
      }
    });
  }

  return {
    banner: statusWriteBanner(
      mapStatusWriteFailure(mutationFailure),
      args.copy,
    ),
    promptConfirm: async ({ target, variantActionId, waitHidden }) => {
      const hidden = waitHidden();
      args.dispatch({ type: "closeAll" });
      await hidden;
      const prompt = confirmSheetCopy(target, args.copy);
      const choice = await presentConfirmDialog({
        title: prompt.title,
        message: prompt.description,
        confirmLabel: prompt.confirmLabel,
        cancelLabel: args.copy.cancel,
        tone: confirmIsDestructive(target) ? "danger" : "default",
      });
      if (choice === "cancel") {
        mutation.reset();
        args.dispatch({
          type: "cancelStatusConfirm",
          restore:
            target.kind === "archive-variant" ||
            target.kind === "restore-variant"
              ? "variantActions"
              : "idle",
          variantActionId,
        });
        return;
      }
      await submitConfirm(target);
    },
  };
}

export function useProductDetailActions(args: {
  readonly product: ProductDetailViewModel | null;
  readonly productId: string | null;
  readonly dispatch: (action: ProductDetailSheetAction) => void;
  readonly status: DetailStatusWrite;
  readonly openPicker: () => void;
  readonly bumpPhotosFocus: () => void;
}): {
  readonly goBack: () => void;
  readonly openEdit: () => void;
  readonly onProductActionsHidden: () => void;
  readonly openProductActions: () => void;
  readonly closeProductActions: () => void;
  readonly onProductSheetAction: (action: ProductSheetActionId) => void;
} {
  const router = useRouter();
  const actionsHidden = useSheetHiddenWaiter();

  function navigateEdit(): void {
    args.dispatch({ type: "closeAll" });
    if (args.productId !== null) {
      router.push(productEditorHref(args.productId));
    }
  }

  function focusPhotosAfterActions(): void {
    const hidden = actionsHidden.wait();
    args.dispatch({ type: "closeAll" });
    args.bumpPhotosFocus();
    void hidden.then(() => {
      args.openPicker();
    });
  }

  return {
    goBack: () => {
      router.back();
    },
    openEdit: navigateEdit,
    onProductActionsHidden: actionsHidden.notify,
    openProductActions: () => {
      args.dispatch({ type: "openProductActions" });
    },
    closeProductActions: () => {
      args.dispatch({ type: "closeAll" });
    },
    onProductSheetAction: (action) => {
      if (args.product === null) {
        return;
      }
      const result = resultForProductSheetAction({
        action,
        archived: args.product.archived,
      });
      if (result.kind === "navigate-edit") {
        navigateEdit();
        return;
      }
      if (result.kind === "focus-photos") {
        focusPhotosAfterActions();
        return;
      }
      void args.status.promptConfirm({
        target: result.target,
        variantActionId: null,
        waitHidden: actionsHidden.wait,
      });
    },
  };
}
