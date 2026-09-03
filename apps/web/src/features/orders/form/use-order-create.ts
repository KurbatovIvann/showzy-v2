/**
 * Order create composer (SHO-379). RHF draft + onboarding-style planner
 * (`submit` vs `retry`) + `useContractMutation`. Dirty leave uses
 * `useBlocker`. Views do not own the client.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import { describeQueryFailure, describeWireCode } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { interpolate } from "../../../i18n/locale";
import {
  applyOrderCreateSuccess,
  bindOrderCreateMutate,
  type CreateOrderPayload,
} from "../api/create";
import { useListMine } from "../../companies/shared/list-mine";
import {
  canCreateOrders,
  orderCreateScreenActions,
  type CompanyRole,
} from "../shared/order-permissions";
import { useOrdersCopy } from "../shared/use-orders-copy";
import {
  fieldErrorsFromFormState,
  mapOrderFormFailure,
  mapValidationIssues,
  resolveOrderFormCopy,
  rhfItemsMessage,
  type BannerKey,
} from "./order-form-copy";
import {
  cloneOrderFormDraft,
  emptyFieldErrors,
  emptyOrderFormDraft,
  formatOrderLineQuantity,
  stepQuantityMilli,
  type OrderFormDraft,
  type OrderFormFieldErrors,
} from "./order-form-draft";
import { classifyOrderFormLoad } from "./order-form-load";
import {
  parseThenPlanOrderFormSave,
  type OrderFormWrite,
} from "./order-form-plan";
import { orderFormResolver } from "./order-form.schema";
import {
  commitProductPickerPicks,
  emptyProductPicker,
  productPickerOpen,
  productPickerPicks,
  productPickerSelectedIds,
  productPickerSelectedVariantIds,
  reduceProductPicker,
  type ProductPickerState,
} from "./product-picker";
import { useOrderCreateLookups } from "./use-order-create-lookups";

function isCompanyRole(value: string): value is CompanyRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "employee"
  );
}

function matchesLookupQuery(haystack: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return haystack.toLowerCase().includes(needle);
}

export function useOrderCreate(args: {
  readonly onCreated: (orderId: string) => void;
}) {
  const copy = useOrdersCopy();
  const formCopy = copy.create;
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const listMine = useListMine();
  const membership = (listMine.data?.memberships ?? []).find(
    (item) => item.company.id === activeCompanyId,
  );
  const canCreate =
    membership !== undefined &&
    isCompanyRole(membership.role) &&
    canCreateOrders(membership.role);
  const clientReady = activeCompanyId !== null;
  const loadState = classifyOrderFormLoad({ canCreate, clientReady });

  const form = useForm<OrderFormDraft>({
    defaultValues: emptyOrderFormDraft(),
    resolver: orderFormResolver,
    mode: "onSubmit",
  });
  const { isDirty, errors, isSubmitted, isValidating } = form.formState;
  const [lastWrite, setLastWrite] = useState<OrderFormWrite | null>(null);
  const [localBanner, setLocalBanner] = useState<BannerKey | null>(null);
  const [plannerErrors, setPlannerErrors] =
    useState<OrderFormFieldErrors>(emptyFieldErrors());
  const [picker, setPicker] = useState<ProductPickerState>(emptyProductPicker);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const skipLeaveRef = useRef(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty;
  const onCreatedRef = useRef(args.onCreated);
  onCreatedRef.current = args.onCreated;

  const lookups = useOrderCreateLookups({
    enabled: loadState.kind === "ready",
    variantProductId: picker.kind === "variants" ? picker.productId : null,
  });

  const mutation = useContractMutation((input: CreateOrderPayload, options) =>
    bindOrderCreateMutate(apiRef.current)(input, options),
  );

  const shouldBlockFn = useCallback(() => {
    if (skipLeaveRef.current) {
      return false;
    }
    return dirtyRef.current;
  }, []);

  const blocker = useBlocker({
    shouldBlockFn,
    withResolver: true,
    enableBeforeUnload: true,
  });

  const failure = mutation.isError
    ? describeQueryFailure(mutation.error)
    : null;
  const wireCode = mutation.isError ? describeWireCode(mutation.error) : null;
  const serverFields = mutation.isError
    ? mapValidationIssues(mutation.error, lastWrite)
    : null;
  const fieldKeys = fieldErrorsFromFormState({
    submitted: isSubmitted,
    customerMessage: errors.customerId?.message,
    itemsMessage: rhfItemsMessage(errors.items),
    commentMessage: errors.comment?.message,
    planner: plannerErrors,
    server: serverFields,
  });
  const failureBanner = mapOrderFormFailure(failure?.kind ?? null, wireCode);
  const resolved = resolveOrderFormCopy(formCopy, {
    customerError: fieldKeys.customer,
    itemsError: fieldKeys.items,
    commentError: fieldKeys.comment,
    banner: localBanner ?? failureBanner,
    pending: mutation.isPending,
    clientReady,
    canCreate,
  });
  const showSubmit =
    orderCreateScreenActions({ canCreate }).showSubmit &&
    resolved.showSubmit &&
    loadState.kind === "ready";

  const watched = form.watch();
  const customers = useMemo(
    () =>
      lookups.customers.filter((customer) =>
        matchesLookupQuery(
          `${customer.name} ${customer.phone ?? ""}`,
          customerQuery,
        ),
      ),
    [customerQuery, lookups.customers],
  );
  const products = useMemo(
    () =>
      lookups.products.filter((product) =>
        matchesLookupQuery(product.name, productQuery),
      ),
    [lookups.products, productQuery],
  );

  function dispatchPicker(
    event: Parameters<typeof reduceProductPicker>[1],
  ): void {
    setPicker((current) => reduceProductPicker(current, event));
  }

  async function submit(): Promise<void> {
    if (mutation.isPending || !canCreate) {
      return;
    }
    setLocalBanner(null);
    const plan = parseThenPlanOrderFormSave({
      draft: cloneOrderFormDraft(form.getValues()),
      lastWrite,
      lastFailureKind: failure?.kind ?? null,
      lastWireCode: wireCode,
    });
    if (plan.kind === "invalid") {
      setPlannerErrors(plan.errors);
      return;
    }
    setPlannerErrors(emptyFieldErrors());
    if (plan.kind === "write") {
      setLastWrite(plan.write);
    }
    try {
      const result =
        plan.kind === "retry"
          ? await mutation.retry()
          : await mutation.submit(plan.write.input);
      skipLeaveRef.current = true;
      applyOrderCreateSuccess(queryClient, activeCompanyId);
      onCreatedRef.current(result.orderId);
    } catch {
      // Field/banner mapping comes from mutation.error + lastWrite.
    }
  }

  return {
    copy,
    formCopy,
    loadState,
    customerId: watched.customerId,
    customerName: watched.customerName,
    comment: watched.comment,
    items: watched.items.map((item) => ({
      key: item.key,
      productName: item.productName,
      variantName: item.variantName,
      quantityLabel: formatOrderLineQuantity(item.quantityMilli),
    })),
    customerError: resolved.customerError,
    itemsError: resolved.itemsError,
    commentError: resolved.commentError,
    banner: resolved.banner,
    pending: mutation.isPending,
    validating: isValidating,
    submitLabel: resolved.submitLabel,
    submitDisabled: resolved.submitDisabled,
    fieldsEditable: resolved.fieldsEditable,
    showSubmit,
    leaveOpen: blocker.status === "blocked",
    customerOpen,
    customerQuery,
    customers,
    customersLoading: lookups.customersStatus === "pending",
    productQuery,
    products,
    productsLoading: lookups.productsStatus === "pending",
    pickerOpen: productPickerOpen(picker),
    pickerKind: picker.kind,
    pickerProductName: picker.kind === "variants" ? picker.productName : null,
    pickerSelectedIds: productPickerSelectedIds(productPickerPicks(picker)),
    pickerSelectedVariantIds: productPickerSelectedVariantIds(picker),
    pickerDoneLabel: interpolate(formCopy.productSheetDone, {
      count: String(productPickerPicks(picker).length),
    }),
    variants: lookups.variants,
    variantsLoading: lookups.variantsStatus === "pending",
    variantsError: lookups.variantsStatus === "error",
    pickCustomer: (customer: {
      readonly id: string;
      readonly name: string;
    }) => {
      form.setValue("customerId", customer.id, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      form.setValue("customerName", customer.name, { shouldDirty: true });
      setPlannerErrors((prev) => ({ ...prev, customer: null }));
      setCustomerOpen(false);
      setCustomerQuery("");
      mutation.reset();
      setLocalBanner(null);
    },
    setCustomerOpen,
    setCustomerQuery,
    setProductQuery,
    openPicker: () => {
      setProductQuery("");
      dispatchPicker({ type: "open" });
    },
    closePicker: () => {
      dispatchPicker({ type: "close" });
      setProductQuery("");
    },
    toggleSimpleProduct: (productId: string, productName: string) => {
      dispatchPicker({ type: "toggleSimple", productId, productName });
    },
    openVariants: (productId: string, productName: string) => {
      dispatchPicker({ type: "openVariants", productId, productName });
    },
    closeVariants: () => {
      dispatchPicker({ type: "closeVariants" });
    },
    pickVariant: (variantId: string, variantName: string | null) => {
      dispatchPicker({ type: "pickVariant", variantId, variantName });
    },
    commitPicker: () => {
      const result = commitProductPickerPicks(
        cloneOrderFormDraft(form.getValues()),
        productPickerPicks(picker),
      );
      form.setValue("items", result.draft.items, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      form.setValue("nextDraftSerial", result.draft.nextDraftSerial, {
        shouldDirty: true,
      });
      setPlannerErrors((prev) => ({ ...prev, items: null }));
      if (result.rejected !== null) {
        setLocalBanner(result.rejected);
      }
      dispatchPicker({ type: "close" });
      setProductQuery("");
      mutation.reset();
    },
    stepQuantity: (index: number, delta: number) => {
      const items = form.getValues("items").map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantityMilli: stepQuantityMilli(item.quantityMilli, delta),
            }
          : item,
      );
      form.setValue("items", items, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      mutation.reset();
    },
    removeItem: (index: number) => {
      const items = form.getValues("items").toSpliced(index, 1);
      form.setValue("items", items, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
      setPlannerErrors((prev) => ({
        ...prev,
        items: items.length === 0 ? prev.items : null,
      }));
      mutation.reset();
      setLocalBanner(null);
    },
    changeComment: (value: string) => {
      form.setValue("comment", value, { shouldDirty: true });
      setPlannerErrors((prev) => ({ ...prev, comment: null }));
      mutation.reset();
      setLocalBanner(null);
    },
    submit: () => {
      void submit();
    },
    stay: () => {
      blocker.reset?.();
    },
    leave: () => {
      blocker.proceed?.();
    },
  };
}

export type OrderCreateModel = ReturnType<typeof useOrderCreate>;
