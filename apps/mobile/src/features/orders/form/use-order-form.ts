import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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
  addOrderLine,
  cloneOrderFormDraft,
  emptyOrderFormDraft,
  stepQuantityMilli,
  type OrderFormDraft,
  type OrderFormLineDraft,
} from "./order-form-draft";
import { classifyOrderFormLoad } from "./order-form-load";
import { orderFormResolver } from "./order-form.schema";
import { optionSelectItems, type OptionSelectItem } from "./option-select";
import { useOrderFormLookups } from "./use-order-form-lookups";
import { useOrderSave } from "./use-order-save";
import { useUnsavedOrderGuard } from "./use-unsaved-order-guard";

export type OrderFormModel = ReturnType<typeof useOrderForm>;

export type OrderFormSheetState =
  | { readonly kind: "closed" }
  | { readonly kind: "customer" }
  | { readonly kind: "products" }
  | {
      readonly kind: "variants";
      readonly productId: string;
      readonly productName: string;
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
  const [sheet, setSheet] = useState<OrderFormSheetState>({ kind: "closed" });
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyOrderFormLoad({
    canCreate,
    clientReady,
  });

  const lookups = useOrderFormLookups({
    enabled: loadState.kind === "ready",
    variantProductId: sheet.kind === "variants" ? sheet.productId : null,
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

  const { armLeave, requestLeave } = useUnsavedOrderGuard({
    dirty: isDirty,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen: sheet.kind !== "closed",
    closeSheet: () => {
      setSheet({ kind: "closed" });
    },
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

  const productOptions: readonly OptionSelectItem[] = optionSelectItems(
    lookups.productRows.map((row) => ({
      id: row.id,
      name: row.name,
      description:
        row.variantCount === 0
          ? formCopy.variantsNone
          : itemCountLabel(row.variantCount, locale, formCopy.variants),
    })),
  );

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

  function addPickedLine(input: {
    readonly productId: string;
    readonly variantId: string | null;
    readonly productName: string;
    readonly variantName: string | null;
  }): void {
    const result = addOrderLine(cloneOrderFormDraft(getValues()), input);
    if (!result.ok) {
      setLocalBanner(result.reason);
      setSheet({ kind: "closed" });
      return;
    }
    append(result.line);
    setValue("nextDraftSerial", result.draft.nextDraftSerial, {
      shouldDirty: true,
    });
    setSheet({ kind: "closed" });
    onFieldEdit();
  }

  function pickCustomer(id: string): void {
    const option = lookups.customerOptions.find((row) => row.id === id);
    setValue("customerId", id, { shouldDirty: true });
    setValue("customerName", option?.name ?? "", { shouldDirty: true });
    setSheet({ kind: "closed" });
    onFieldEdit();
  }

  function pickProduct(id: string): void {
    const row = lookups.productRows.find((item) => item.id === id);
    if (row === undefined) {
      return;
    }
    if (row.variantCount > 0) {
      setSheet({ kind: "variants", productId: row.id, productName: row.name });
      return;
    }
    addPickedLine({
      productId: row.id,
      variantId: null,
      productName: row.name,
      variantName: null,
    });
  }

  function pickVariant(id: string): void {
    const current = sheetRef.current;
    if (current.kind !== "variants") {
      return;
    }
    const option = lookups.variantOptions.find((row) => row.id === id);
    addPickedLine({
      productId: current.productId,
      variantId: id,
      productName: current.productName,
      variantName: option?.name ?? null,
    });
  }

  const customerId = watch("customerId");
  const customerName = watch("customerName");

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
    productsValue,
    footerLinesLabel: itemCountLabel(items.length, locale, copy.items),
    sheet,
    customerOptions: lookups.customerOptions,
    productOptions,
    variantOptions: lookups.variantOptions,
    variantsReady: lookups.variantsReady,
    selectedCustomerId: customerId.length > 0 ? customerId : null,
    onFieldEdit,
    requestLeave,
    openCustomerSheet: () => {
      setSheet({ kind: "customer" });
    },
    openProductsSheet: () => {
      setSheet({ kind: "products" });
    },
    closeSheet: () => {
      setSheet({ kind: "closed" });
    },
    pickCustomer,
    pickProduct,
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
