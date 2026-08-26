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
import { getProductQueryOptions } from "../api/product-detail-query";
import { useProductPhotos } from "../photos/use-product-photos";
import {
  PRODUCT_FORM_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
} from "../shared/product-caps";
import { productIdFromParam } from "../shared/product-id";
import {
  canCreateProducts,
  canEditProducts,
} from "../shared/product-permissions";
import {
  cloneProductFormDraft,
  draftFromProduct,
  emptyFieldErrors,
  emptyProductFormDraft,
  parseProductFormUiDraft,
  snapshotFromProduct,
  upsertVariantDraft,
  type ProductFormDraft,
  type ProductFormFieldErrors,
  type ProductFormMode,
  type ProductFormSnapshot,
  type ProductFormVariantDraft,
} from "./product-form-draft";
import {
  mapProductFormFailure,
  mapRhfVariantFieldErrors,
  mapValidationIssues,
  overlayVariantFieldErrors,
  resolveProductFormCopy,
  type BannerKey,
} from "./product-form-copy";
import { classifyProductFormLoad } from "./product-form-load";
import {
  isNameErrorKey,
  isPriceErrorKey,
  productFormResolver,
} from "./product-form.schema";
import { useProductSave } from "./use-product-save";
import { useUnsavedProductGuard } from "./use-unsaved-product-guard";

export type ProductFormModel = ReturnType<typeof useProductForm>;

export type ProductFormVariantSheetState =
  | { readonly kind: "closed" }
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly key: string };

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

  const {
    control,
    reset,
    getValues,
    setValue,
    handleSubmit,
    clearErrors,
    formState,
  } = useForm<ProductFormDraft>({
    defaultValues: emptyProductFormDraft(),
    resolver: productFormResolver,
    mode: "onSubmit",
  });
  const { append, update, fields } = useFieldArray({
    control,
    name: "variants",
  });
  const { isDirty, errors, isSubmitted } = formState;

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
    getDraft: () => cloneProductFormDraft(getValues()),
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

  const dirty = isDirty || photos.dirty;
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
  const rhfName = errors.name?.message;
  const rhfPrice = errors.priceText?.message;
  const fieldErrors: ProductFormFieldErrors = {
    name:
      (isSubmitted && rhfName !== undefined && isNameErrorKey(rhfName)
        ? rhfName
        : null) ??
      clientErrors.name ??
      serverFields?.name ??
      null,
    price:
      (isSubmitted && rhfPrice !== undefined && isPriceErrorKey(rhfPrice)
        ? rhfPrice
        : null) ??
      clientErrors.price ??
      serverFields?.price ??
      null,
    variants: overlayVariantFieldErrors(
      serverFields?.variants,
      clientErrors.variants,
      isSubmitted
        ? mapRhfVariantFieldErrors(getValues().variants, errors.variants)
        : undefined,
    ),
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

  function onFieldEdit(): void {
    clearErrors();
    setClientErrors(emptyFieldErrors());
    setLocalBanner(null);
    saveApi.resetMutation();
  }

  function openNewVariant(): void {
    if (getValues().variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
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
    const current = cloneProductFormDraft(getValues());
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
    onFieldEdit();
  }

  const headerTitle =
    args.mode === "create" ? copy.stub.createTitle : copy.stub.editTitle;
  const variants: ProductFormVariantDraft[] = fields.map((field) => ({
    key: field.key,
    variantId: field.variantId,
    name: field.name,
    priceText: field.priceText,
    archived: field.archived,
  }));
  const variantSheetInitial =
    variantSheet.kind === "edit"
      ? (variants.find((variant) => variant.key === variantSheet.key) ?? null)
      : null;

  return {
    copy,
    mode: args.mode,
    control,
    originName: origin.name,
    originPriceText: origin.priceText,
    variants,
    state: loadState,
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
      variants.length < PRODUCT_FORM_MAX_VARIANTS,
    nameMaxLength: PRODUCT_NAME_MAX,
    headerTitle,
    variantSheet,
    variantSheetInitial,
    photos,
    onFieldEdit,
    requestLeave,
    openNewVariant,
    openEditVariant,
    closeVariantSheet,
    saveVariantFromSheet,
    retry: () => {
      void query.refetch();
    },
    save: () => {
      void handleSubmit(
        () => {
          void saveApi.save();
        },
        () => {
          const parsed = parseProductFormUiDraft(
            cloneProductFormDraft(getValues()),
          );
          if (!parsed.ok) {
            setClientErrors(parsed.errors);
          }
        },
      )();
    },
  };
}
