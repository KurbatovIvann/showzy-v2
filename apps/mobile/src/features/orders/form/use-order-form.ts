import { useRouter } from "expo-router";
import { useReducer, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale, interpolate } from "../../../i18n/locale";
import { ordersCopy } from "../../../i18n/orders";
import { itemCountLabel } from "../shared/item-count";
import { orderDetailHref } from "../shared/order-hrefs";
import {
  canCreateOrders,
  orderCreateScreenActions,
} from "../shared/order-permissions";
import type { OrderThumbnailView } from "../shared/order-thumbnails";
import {
  fieldErrorsFromFormState,
  mapOrderFormFailure,
  mapValidationIssues,
  resolveOrderFormCopy,
  rhfItemsMessage,
  rhfPathsForFieldErrors,
  type BannerKey,
} from "./order-form-copy";
import {
  cloneOrderFormDraft,
  emptyOrderFormDraft,
  stepQuantityMilli,
  type OrderFormDraft,
  type OrderFormLineDraft,
} from "./order-form-draft";
import { classifyOrderFormLoad } from "./order-form-load";
import { orderFormResolver } from "./order-form.schema";
import {
  commitProductPickerPicks,
  emptyProductPicker,
  productPickerOpen,
  productPickerPicks,
  productPickerSelectedIds,
  productPickerSelectedVariantIds,
  reduceProductPicker,
} from "./product-picker";
import {
  productPickerParentSelectedNames,
  productPickerParentSubtitle,
  type ProductSelectRow,
  type ProductSelectVariantRow,
} from "./product-select";
import { useOrderFormLookups } from "./use-order-form-lookups";
import { useOrderSave } from "./use-order-save";
import { useUnsavedOrderGuard } from "./use-unsaved-order-guard";

export type OrderFormModel = ReturnType<typeof useOrderForm>;

const EMPTY_THUMBNAIL: OrderThumbnailView = {
  fileId: null,
  url: null,
  failed: false,
};

export function useOrderForm() {
  const locale = detectLocale();
  const copy = ordersCopy(locale);
  const formCopy = copy.create;
  const router = useRouter();
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canCreate = canCreateOrders(membership.role);

  const {
    control,
    reset,
    getValues,
    setValue,
    watch,
    handleSubmit,
    setError,
    clearErrors,
    formState,
  } = useForm<OrderFormDraft>({
    defaultValues: emptyOrderFormDraft(),
    resolver: orderFormResolver,
    mode: "onSubmit",
  });
  const { append, update, remove, fields } = useFieldArray({
    control,
    name: "items",
  });
  const { isDirty, errors, isSubmitted } = formState;

  const [localBanner, setLocalBanner] = useState<BannerKey | null>(null);
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [picker, dispatchPicker] = useReducer(
    reduceProductPicker,
    emptyProductPicker(),
  );
  const pickerRef = useRef(picker);
  pickerRef.current = picker;

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyOrderFormLoad({
    canCreate,
    clientReady,
  });

  const lookups = useOrderFormLookups({
    enabled: loadState.kind === "ready",
    variantProductId: picker.kind === "variants" ? picker.productId : null,
  });

  const armLeaveRef = useRef(() => {});

  const saveApi = useOrderSave({
    loadKind: loadState.kind,
    getDraft: () => cloneOrderFormDraft(getValues()),
    setOrigin: (draft) => {
      reset(draft);
    },
    onSaved: (orderId) => {
      armLeaveRef.current();
      router.replace(orderDetailHref(orderId));
      return Promise.resolve();
    },
    setFieldErrors: (nextFieldErrors) => {
      for (const entry of rhfPathsForFieldErrors(nextFieldErrors)) {
        setError(entry.name, { type: "validate", message: entry.message });
      }
    },
  });

  function closeAllSheets(): void {
    setCustomerSheetOpen(false);
    dispatchPicker({ type: "close" });
  }

  const { armLeave, requestLeave } = useUnsavedOrderGuard({
    dirty: isDirty,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen: customerSheetOpen || productPickerOpen(picker),
    closeSheet: closeAllSheets,
  });
  armLeaveRef.current = armLeave;

  const failure = saveApi.isMutationError
    ? describeQueryFailure(saveApi.mutationError)
    : null;
  const wire = saveApi.isMutationError
    ? describeWireError(saveApi.mutationError)
    : null;
  const serverFields = saveApi.isMutationError
    ? mapValidationIssues(saveApi.mutationError, saveApi.lastWrite)
    : null;
  const itemsMessage = rhfItemsMessage(errors.items);
  const fieldErrors = fieldErrorsFromFormState({
    submitted: isSubmitted,
    customerMessage: errors.customerId?.message,
    itemsMessage,
    commentMessage: errors.comment?.message,
    server: serverFields,
  });
  const mappedBanner =
    localBanner ??
    mapOrderFormFailure(failure?.kind ?? null, wire?.code ?? null);
  const pending = saveApi.pending;
  const resolved = resolveOrderFormCopy(formCopy, {
    customerError: fieldErrors.customer,
    itemsError: fieldErrors.items,
    commentError: fieldErrors.comment,
    banner: mappedBanner,
    pending,
    clientReady,
    canCreate,
  });
  const showSubmit =
    orderCreateScreenActions({ canCreate }).showSubmit &&
    resolved.showSubmit &&
    loadState.kind === "ready";

  const items: OrderFormLineDraft[] = fields.map((field) => ({
    key: field.key,
    productId: field.productId,
    variantId: field.variantId,
    productName: field.productName,
    variantName: field.variantName,
    quantityMilli: field.quantityMilli,
  }));

  const picks = productPickerPicks(picker);
  const selectedProductIds = productPickerSelectedIds(picks);

  const productSelectRows: readonly ProductSelectRow[] =
    lookups.productRows.map((row) => {
      const thumbnail =
        lookups.thumbnailsByProductId.get(row.id) ?? EMPTY_THUMBNAIL;
      const selectedNames = productPickerParentSelectedNames(picks, row.id);
      return {
        id: row.id,
        name: row.name,
        hasVariants: row.variantCount > 0,
        variantsLabel: productPickerParentSubtitle({
          variantCount: row.variantCount,
          selectedNames,
          noneLabel: formCopy.variantsNone,
          countLabel: itemCountLabel(
            row.variantCount,
            locale,
            formCopy.variants,
          ),
          selectedLabel: formCopy.variantsSelected,
        }),
        thumbnailFileId: thumbnail.fileId,
        thumbnailUrl: thumbnail.url,
        thumbnailFailed: thumbnail.failed,
      };
    });

  const variantSelectRows: readonly ProductSelectVariantRow[] =
    lookups.variantOptions.map((option) => ({
      id: option.id,
      name: option.name,
    }));

  const productsValue =
    items.length === 0
      ? undefined
      : interpolate(formCopy.addProductsValue, {
          count: String(items.length),
        });

  function onFieldEdit(): void {
    clearErrors();
    setLocalBanner(null);
    saveApi.resetMutation();
  }

  function confirmProductPicks(): void {
    const result = commitProductPickerPicks(
      cloneOrderFormDraft(getValues()),
      productPickerPicks(pickerRef.current),
    );
    for (const line of result.lines) {
      append(line);
    }
    if (result.lines.length > 0) {
      setValue("nextDraftSerial", result.draft.nextDraftSerial, {
        shouldDirty: true,
      });
      onFieldEdit();
    }
    if (result.rejected !== null) {
      setLocalBanner(result.rejected);
    }
    dispatchPicker({ type: "close" });
  }

  function pickCustomer(id: string): void {
    const option = lookups.customerOptions.find((row) => row.id === id);
    setValue("customerId", id, { shouldDirty: true });
    setValue("customerName", option?.name ?? "", { shouldDirty: true });
    setCustomerSheetOpen(false);
    onFieldEdit();
  }

  function toggleProduct(id: string): void {
    const row = lookups.productRows.find((item) => item.id === id);
    if (row === undefined) {
      return;
    }
    if (row.variantCount > 0) {
      dispatchPicker({
        type: "openVariants",
        productId: row.id,
        productName: row.name,
      });
      return;
    }
    dispatchPicker({
      type: "toggleSimple",
      productId: row.id,
      productName: row.name,
    });
  }

  function pickVariant(id: string): void {
    const current = pickerRef.current;
    if (current.kind !== "variants") {
      return;
    }
    const option = lookups.variantOptions.find((row) => row.id === id);
    dispatchPicker({
      type: "pickVariant",
      variantId: id,
      variantName:
        option?.name != null && option.name.length > 0 ? option.name : null,
    });
  }

  const customerId = watch("customerId");
  const customerName = watch("customerName");
  const selectedCustomer = lookups.customerOptions.find(
    (row) => row.id === customerId,
  );
  const customerPhone = selectedCustomer?.description;

  return {
    copy,
    control,
    items,
    state: loadState,
    customerError: resolved.customerError,
    itemsError: resolved.itemsError,
    commentError: resolved.commentError,
    banner: resolved.banner,
    pending,
    submitDisabled: resolved.submitDisabled || loadState.kind !== "ready",
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    showSubmit,
    customerName: customerName.length > 0 ? customerName : undefined,
    customerPhone,
    productsValue,
    footerLinesLabel: itemCountLabel(items.length, locale, copy.items),
    customerSheetOpen,
    productSheetOpen: productPickerOpen(picker),
    productPickerSessionOpen: productPickerOpen(picker),
    productPickerLevel: picker.kind === "variants" ? "variants" : "products",
    productPickerVariantsTitle:
      picker.kind === "variants" ? picker.productName : "",
    customerOptions: lookups.customerOptions,
    productSelectRows,
    variantSelectRows,
    variantsStatus: lookups.variantsStatus,
    selectedCustomerId: customerId.length > 0 ? customerId : null,
    selectedProductIds,
    selectedVariantIds: productPickerSelectedVariantIds(picker),
    productPickCount: picks.length,
    lineThumbnail: (productId: string): OrderThumbnailView =>
      lookups.thumbnailsByProductId.get(productId) ?? EMPTY_THUMBNAIL,
    onFieldEdit,
    requestLeave,
    openCustomerSheet: () => {
      dispatchPicker({ type: "close" });
      setCustomerSheetOpen(true);
    },
    openProductsSheet: () => {
      setCustomerSheetOpen(false);
      dispatchPicker({ type: "open" });
    },
    closeCustomerSheet: () => {
      setCustomerSheetOpen(false);
    },
    closeProductSheet: () => {
      dispatchPicker({ type: "close" });
    },
    backFromVariants: () => {
      dispatchPicker({ type: "closeVariants" });
    },
    pickCustomer,
    toggleProduct,
    confirmProductPicks,
    pickVariant,
    stepLine: (index: number, deltaUnits: number) => {
      const current = getValues().items[index];
      if (current === undefined) {
        return;
      }
      update(index, {
        ...current,
        quantityMilli: stepQuantityMilli(current.quantityMilli, deltaUnits),
      });
      onFieldEdit();
    },
    removeLine: (index: number) => {
      remove(index);
      onFieldEdit();
    },
    save: () => {
      void handleSubmit(
        () => {
          void saveApi.save();
        },
        () => {
          saveApi.resetMutation();
        },
      )();
    },
  };
}
