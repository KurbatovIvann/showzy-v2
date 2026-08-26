import type { WireErrorCode } from "@showzy/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRouter } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";

import { useApiClient } from "../../../api/api-provider";
import { useContractMutation } from "../../../api/contract-mutation";
import {
  describeQueryFailure,
  describeWireError,
  type QueryFailureKind,
} from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale } from "../../../i18n/locale";
import { productsCopy } from "../../../i18n/products";
import { invalidateCatalogAfterStatusWrite } from "./product-archive";
import { productIdFromParam } from "./product-detail-model";
import { getProductQueryOptions } from "./product-detail-query";
import {
  applyWriteSuccess,
  classifyProductFormLoad,
  compactDraft,
  draftFromProduct,
  emptyFieldErrors,
  emptyProductFormDraft,
  formatProductFormFooterPrice,
  isProductFormDirty,
  mapProductFormFailure,
  mapValidationIssues,
  patchDraft,
  planProductFormSave,
  productFormFieldChanged,
  PRODUCT_FORM_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
  resolveProductFormCopy,
  snapshotFromProduct,
  upsertVariantDraft,
  type BannerKey,
  type ProductFormDraft,
  type ProductFormFieldErrors,
  type ProductFormMode,
  type ProductFormSnapshot,
  type ProductFormWrite,
} from "./product-form-model";
import { bindProductFormMutate } from "./product-form-mutation";
import { canCreateProducts, canEditProducts } from "./product-permissions";

export type ProductFormModel = ReturnType<typeof useProductForm>;

export type ProductFormVariantSheetState =
  | { readonly kind: "closed" }
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly key: string };

type LastFailure = {
  readonly kind: QueryFailureKind | null;
  readonly wire: WireErrorCode | null;
};

const NO_FAILURE: LastFailure = { kind: null, wire: null };

export function useProductForm(args: {
  readonly mode: ProductFormMode;
  readonly idParam?: string | string[];
}) {
  const copy = productsCopy(detectLocale());
  const apiClient = useApiClient();
  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const productId =
    args.mode === "edit" ? productIdFromParam(args.idParam) : null;
  const canWrite =
    args.mode === "create"
      ? canCreateProducts(membership.role)
      : canEditProducts(membership.role);

  const [draft, setDraft] = useState<ProductFormDraft>(emptyProductFormDraft);
  const [origin, setOrigin] = useState<ProductFormDraft>(emptyProductFormDraft);
  const [baseline, setBaseline] = useState<ProductFormSnapshot | null>(null);
  const [clientErrors, setClientErrors] =
    useState<ProductFormFieldErrors>(emptyFieldErrors);
  const [localBanner, setLocalBanner] = useState<BannerKey | null>(null);
  const [lastWrite, setLastWrite] = useState<ProductFormWrite | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [confirmLeaveVisible, setConfirmLeaveVisible] = useState(false);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [variantSheet, setVariantSheet] =
    useState<ProductFormVariantSheetState>({ kind: "closed" });

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const lastWriteRef = useRef(lastWrite);
  lastWriteRef.current = lastWrite;
  const variantSheetRef = useRef(variantSheet);
  variantSheetRef.current = variantSheet;
  const pendingLeaveActionRef = useRef<NavigationAction | null>(null);
  const productIdRef = useRef(productId);
  productIdRef.current = productId;
  const lastFailureRef = useRef<LastFailure>(NO_FAILURE);
  const saveBusyRef = useRef(false);
  const mountedRef = useRef(true);
  const hydratedIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const query = useQuery(
    getProductQueryOptions({
      client: canWrite ? apiClient : null,
      companyId: activeCompanyId,
      productId,
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
    draftRef.current = next;
    baselineRef.current = snap;
    setDraft(next);
    setOrigin(next);
    setBaseline(snap);
  }, [args.mode, query.data]);

  const mutation = useContractMutation((input: ProductFormWrite, options) => {
    const current = apiRef.current;
    if (current === null) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return bindProductFormMutate(current)(input, options);
  });

  const failure = mutation.isError
    ? describeQueryFailure(mutation.error)
    : null;
  const wire = mutation.isError ? describeWireError(mutation.error) : null;
  const serverFields = mutation.isError
    ? mapValidationIssues(mutation.error, lastWrite)
    : null;
  const fieldErrors: ProductFormFieldErrors = {
    name: clientErrors.name ?? serverFields?.name ?? null,
    price: clientErrors.price ?? serverFields?.price ?? null,
    variants: { ...serverFields?.variants, ...clientErrors.variants },
  };
  const mappedBanner =
    localBanner ??
    mapProductFormFailure(failure?.kind ?? null, wire?.code ?? null);
  const pending = saveBusy || mutation.isPending;
  const dirty = isProductFormDirty(draft, origin);

  usePreventRemove(dirty && !pending && !leaveArmed, ({ data }) => {
    pendingLeaveActionRef.current = data.action;
    setConfirmLeaveVisible(true);
  });

  useEffect(() => {
    if (!leaveArmed) {
      return;
    }
    const action = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    if (action !== null) {
      navigation.dispatch(action);
      return;
    }
    router.back();
  }, [leaveArmed, navigation, router]);

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyProductFormLoad({
    mode: args.mode,
    canWrite,
    productId,
    clientReady,
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
  });
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
    lastFailureRef.current = NO_FAILURE;
    mutation.reset();
  }

  function changeName(value: string): void {
    const next = patchDraft(draftRef.current, { name: value });
    draftRef.current = next;
    setDraft(next);
    clearAttempt();
  }

  function changePrice(value: string): void {
    const next = patchDraft(draftRef.current, { priceText: value });
    draftRef.current = next;
    setDraft(next);
    clearAttempt();
  }

  function requestLeave(): void {
    router.back();
  }

  function dismissLeave(): void {
    pendingLeaveActionRef.current = null;
    setConfirmLeaveVisible(false);
  }

  function confirmLeave(): void {
    setConfirmLeaveVisible(false);
    setLeaveArmed(true);
  }

  function openNewVariant(): void {
    if (draftRef.current.variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
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
    if (
      sheet.kind === "new" &&
      draftRef.current.variants.length >= PRODUCT_FORM_MAX_VARIANTS
    ) {
      setLocalBanner("too_many_variants");
      setVariantSheet({ kind: "closed" });
      return;
    }
    const next = upsertVariantDraft(draftRef.current, {
      key: sheet.kind === "edit" ? sheet.key : null,
      name: input.name,
      priceText: input.priceText,
    });
    draftRef.current = next;
    setDraft(next);
    setVariantSheet({ kind: "closed" });
    clearAttempt();
  }

  async function finish(): Promise<void> {
    await invalidateCatalogAfterStatusWrite({
      queryClient,
      companyId: activeCompanyId,
    });
    if (mountedRef.current) {
      router.back();
    }
  }

  async function save(): Promise<void> {
    if (
      saveBusyRef.current ||
      apiClient === null ||
      loadState.kind !== "ready"
    ) {
      return;
    }
    saveBusyRef.current = true;
    setSaveBusy(true);
    try {
      for (;;) {
        const compacted = compactDraft(draftRef.current);
        if (compacted.variants.length > PRODUCT_FORM_MAX_VARIANTS) {
          setLocalBanner("too_many_variants");
          return;
        }
        const plan = planProductFormSave({
          mode: args.mode,
          productId: productIdRef.current,
          draft: draftRef.current,
          baseline: baselineRef.current,
          lastWrite: lastWriteRef.current,
          lastFailureKind: lastFailureRef.current.kind,
          lastWireCode: lastFailureRef.current.wire,
        });
        if (plan.kind === "invalid") {
          setClientErrors(plan.errors);
          return;
        }
        if (plan.kind === "noop") {
          await finish();
          return;
        }
        if (plan.kind === "write") {
          lastWriteRef.current = plan.write;
          setLastWrite(plan.write);
        }
        const write = lastWriteRef.current;
        if (write === null) {
          return;
        }
        const result =
          plan.kind === "retry"
            ? await mutation.retry()
            : await mutation.submit(write);
        lastFailureRef.current = NO_FAILURE;
        const applied = applyWriteSuccess({
          draft: draftRef.current,
          baseline: baselineRef.current,
          write,
          result,
        });
        draftRef.current = applied.draft;
        baselineRef.current = applied.baseline;
        setDraft(applied.draft);
        setBaseline(applied.baseline);
        mutation.reset();
        if (applied.done) {
          await finish();
          return;
        }
      }
    } catch (error: unknown) {
      lastFailureRef.current = {
        kind: describeQueryFailure(error).kind,
        wire: describeWireError(error)?.code ?? null,
      };
    } finally {
      saveBusyRef.current = false;
      if (mountedRef.current) {
        setSaveBusy(false);
      }
    }
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
      (args.mode === "edit" && !dirty),
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
    confirmLeaveVisible,
    variantSheet,
    variantSheetInitial,
    requestLeave,
    dismissLeave,
    confirmLeave,
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
      void save();
    },
  };
}
