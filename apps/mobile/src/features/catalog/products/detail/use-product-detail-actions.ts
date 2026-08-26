/**
 * Product archive/restore + navigation, and the shared status-write
 * used by variant archive/restore (one mutation so a failed confirm
 * retries the in-flight attempt — SHO-138 / SHO-160).
 */
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useApiClient } from "../../../../api/api-provider";
import { useContractMutation } from "../../../../api/contract-mutation";
import { describeQueryFailure } from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { presentConfirmDialog } from "../../../../components/ui/present-confirm-dialog";
import { waitForSheetHidden } from "../../../../components/ui/sheet-dismiss";
import type { ProductsDetailCopy } from "../../../../i18n/products";
import {
  bindCatalogStatusMutate,
  invalidateCatalogAfterStatusWrite,
  type CatalogStatusWrite,
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
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const writeBusyRef = useRef(false);
  const mutation = useContractMutation((input: CatalogStatusWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindCatalogStatusMutate(current)(input, options);
  });
  const mutationFailure = mutation.isError
    ? describeQueryFailure(mutation.error).kind
    : null;

  async function submitConfirm(target: ConfirmTarget): Promise<void> {
    if (args.productId === null || writeBusyRef.current || mutation.isPending) {
      return;
    }
    writeBusyRef.current = true;
    try {
      if (planConfirmStatusWrite(mutation.isError) === "retry") {
        await mutation.retry();
      } else {
        await mutation.submit(statusWriteForConfirm(target, args.productId));
      }
      await invalidateCatalogAfterStatusWrite({
        queryClient,
        companyId: activeCompanyId,
      });
      args.dispatch({ type: "closeAll" });
      mutation.reset();
    } catch {
      // Banner is derived from mutation.error.
    } finally {
      writeBusyRef.current = false;
    }
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
