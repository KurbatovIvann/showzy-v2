import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { useApiClient } from "../../../../api/api-provider";
import {
  describeQueryFailure,
  describeWireError,
} from "../../../../api/errors";
import { useActiveCompany } from "../../../../api/query-provider";
import { useResolvedCompany } from "../../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../../i18n/locale";
import { productsCopy } from "../../../../i18n/products";
import { productIdFromParam } from "../detail/product-detail-model";
import { getProductQueryOptions } from "../api/product-detail-query";
import {
  classifyProductFormLoad,
  draftFromProduct,
  emptyFieldErrors,
  emptyProductFormDraft,
  formatProductFormFooterPrice,
  isProductFormDirty,
  mapProductFormFailure,
  mapValidationIssues,
  PRODUCT_FORM_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
  productFormFieldChanged,
  resolveProductFormCopy,
  snapshotFromProduct,
  upsertVariantDraft,
  type BannerKey,
  type ProductFormDraft,
  type ProductFormFieldErrors,
  type ProductFormMode,
  type ProductFormSnapshot,
} from "./product-form-model";
import { productFormResolver } from "./product-form.schema";
import {
  canCreateProducts,
  canEditProducts,
} from "../shared/product-permissions";
import { useProductPhotos } from "../photos/use-product-photos";
import { useProductSave } from "./use-product-save";
import { useUnsavedProductGuard } from "./use-unsaved-product-guard";

export type ProductFormModel = ReturnType<typeof useProductForm>;

export type ProductFormVariantSheetState =
  | { readonly kind: "closed" }
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly key: string };

function toProductFormDraft(values: ProductFormDraft): ProductFormDraft {
  return {
    name: values.name,
    priceText: values.priceText,
    nextDraftSerial: values.nextDraftSerial,
    variants: values.variants.map((variant) => ({
      key: variant.key,
      variantId: variant.variantId,
      name: variant.name,
      priceText: variant.priceText,
      archived: variant.archived,
    })),
  };
}

export function useProductForm(args: {
  readonly mode: ProductFormMode;
  readonly idParam?: string | string[];
}) {
  const copy = productsCopy(detectLocale());
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const routeProductId =
    args.mode === "edit" ? productIdFromParam(args.idParam) : null;
  const canWrite =
    args.mode === "create"
      ? canCreateProducts(membership.role)
      : canEditProducts(membership.role);

  const { reset, setValue, getValues, watch, control } = useForm({
    defaultValues: emptyProductFormDraft(),
    resolver: productFormResolver,
    mode: "onSubmit",
  });
  const { append, update } = useFieldArray({ control, name: "variants" });
  const watched = watch();
  const draft = toProductFormDraft(watched);

  const [origin, setOrigin] = useState<ProductFormDraft>(emptyProductFormDraft);
  const [baseline, setBaseline] = useState<ProductFormSnapshot | null>(null);
  const [clientErrors, setClientErrors] =
    useState<ProductFormFieldErrors>(emptyFieldErrors);
  const [localBanner, setLocalBanner] = useState<BannerKey | null>(null);
  const [variantSheet, setVariantSheet] =
    useState<ProductFormVariantSheetState>({ kind: "closed" });

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const variantSheetRef = useRef(variantSheet);
  variantSheetRef.current = variantSheet;
  const productIdRef = useRef(routeProductId);
  if (routeProductId !== null) {
    productIdRef.current = routeProductId;
  }
  const hydratedIdRef = useRef<string | null>(null);

  const query = useQuery(
    getProductQueryOptions({
      client: canWrite ? apiClient : null,
      companyId: activeCompanyId,
      productId: routeProductId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
    }),
  );

  useEffect(() => {
    if (args.mode !== "edit" || query.data === undefined) {
      return;
    }
    if (hydratedIdRef.current === query.data.id) {
      return;
    }
    hydratedIdRef.current = query.data.id;
    const next = draftFromProduct(query.data);
    const snap = snapshotFromProduct(query.data);
    reset(next);
    baselineRef.current = snap;
    setOrigin(next);
    setBaseline(snap);
  }, [args.mode, query.data, reset]);

  const photos = useProductPhotos({
    productId: routeProductId,
    imageFileIds: query.data?.imageFileIds,
    requireProduct: args.mode === "edit",
    canWrite,
  });

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyProductFormLoad({
    mode: args.mode,
    canWrite,
    productId: routeProductId,
    clientReady,
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
  });

  const armLeaveRef = useRef(() => {});

  const saveApi = useProductSave({
    mode: args.mode,
    loadKind: loadState.kind,
    getDraft: () => toProductFormDraft(getValues()),
    setDraft: (next) => {
      reset(next);
    },
    setOrigin,
    productIdRef,
    baselineRef,
    setBaseline,
    photos,
    onSaved: () => {
      armLeaveRef.current();
      return Promise.resolve();
    },
    setClientErrors,
    setLocalBanner,
  });

  const dirty = isProductFormDirty(draft, origin) || photos.dirty;
  const { armLeave, requestLeave } = useUnsavedProductGuard({
    dirty,
    pending: saveApi.pending,
    copy: copy.form,
    sheetOpen: variantSheet.kind !== "closed",
    closeSheet: () => {
      setVariantSheet({ kind: "closed" });
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
  const fieldErrors: ProductFormFieldErrors = {
    name: clientErrors.name ?? serverFields?.name ?? null,
    price: clientErrors.price ?? serverFields?.price ?? null,
    variants: { ...serverFields?.variants, ...clientErrors.variants },
  };
  const mappedBanner =
    localBanner ??
    mapProductFormFailure(failure?.kind ?? null, wire?.code ?? null);
  const pending = saveApi.pending;
  const resolved = resolveProductFormCopy(copy.form, {
    mode: args.mode,
    nameError: fieldErrors.name,
    priceError: fieldErrors.price,
    variantErrors: fieldErrors.variants,
    banner: mappedBanner,
    pending,
    clientReady,
  });

  function clearAttempt(): void {
    setClientErrors(emptyFieldErrors());
    setLocalBanner(null);
    saveApi.resetMutation();
  }

  function changeName(value: string): void {
    setValue("name", value, { shouldDirty: true, shouldValidate: false });
    clearAttempt();
  }

  function changePrice(value: string): void {
    setValue("priceText", value, { shouldDirty: true, shouldValidate: false });
    clearAttempt();
  }

  function openNewVariant(): void {
    if (
      toProductFormDraft(getValues()).variants.length >=
      PRODUCT_FORM_MAX_VARIANTS
    ) {
      setLocalBanner("too_many_variants");
      return;
    }
    setVariantSheet({ kind: "new" });
  }

  function openEditVariant(key: string): void {
    setVariantSheet({ kind: "edit", key });
  }

  function closeVariantSheet(): void {
    setVariantSheet({ kind: "closed" });
  }

  function saveVariantFromSheet(input: {
    readonly name: string;
    readonly priceText: string;
  }): void {
    const sheet = variantSheetRef.current;
    if (sheet.kind === "closed") {
      return;
    }
    const current = toProductFormDraft(getValues());
    if (
      sheet.kind === "new" &&
      current.variants.length >= PRODUCT_FORM_MAX_VARIANTS
    ) {
      setLocalBanner("too_many_variants");
      setVariantSheet({ kind: "closed" });
      return;
    }
    const next = upsertVariantDraft(current, {
      key: sheet.kind === "edit" ? sheet.key : null,
      name: input.name,
      priceText: input.priceText,
    });
    if (sheet.kind === "new") {
      const created = next.variants[next.variants.length - 1];
      if (created !== undefined) {
        append(created);
      }
    } else {
      const index = current.variants.findIndex(
        (variant) => variant.key === sheet.key,
      );
      const updated = next.variants[index];
      if (index >= 0 && updated !== undefined) {
        update(index, updated);
      }
    }
    setValue("nextDraftSerial", next.nextDraftSerial, { shouldDirty: true });
    setVariantSheet({ kind: "closed" });
    clearAttempt();
  }

  const headerTitle =
    args.mode === "create" ? copy.stub.createTitle : copy.stub.editTitle;
  const variantSheetInitial =
    variantSheet.kind === "edit"
      ? (draft.variants.find((variant) => variant.key === variantSheet.key) ??
        null)
      : null;

  return {
    copy,
    mode: args.mode,
    state: loadState,
    draft,
    nameError: resolved.nameError,
    priceError: resolved.priceError,
    variantErrors: resolved.variantErrors,
    banner: resolved.banner,
    pending,
    submitDisabled:
      resolved.submitDisabled ||
      loadState.kind !== "ready" ||
      (args.mode === "edit" && !dirty && !photos.needsCommit),
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    canAddVariant:
      resolved.fieldsEditable &&
      loadState.kind === "ready" &&
      draft.variants.length < PRODUCT_FORM_MAX_VARIANTS,
    nameMaxLength: PRODUCT_NAME_MAX,
    headerTitle,
    footerPriceLabel: formatProductFormFooterPrice(draft.priceText),
    nameChanged: productFormFieldChanged(args.mode, draft.name, origin.name),
    priceChanged: productFormFieldChanged(
      args.mode,
      draft.priceText,
      origin.priceText,
    ),
    variantSheet,
    variantSheetInitial,
    photos,
    requestLeave,
    openNewVariant,
    openEditVariant,
    closeVariantSheet,
    saveVariantFromSheet,
    retry: () => {
      void query.refetch();
    },
    changeName,
    changePrice,
    save: () => {
      void saveApi.save();
    },
  };
}
