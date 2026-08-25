import type { WireErrorCode } from "@showzy/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
  addVariantRow,
  applyWriteSuccess,
  classifyProductFormLoad,
  compactDraft,
  draftFromProduct,
  emptyFieldErrors,
  emptyProductFormDraft,
  mapProductFormFailure,
  mapValidationIssues,
  patchDraft,
  planProductFormSave,
  PRODUCT_FORM_MAX_VARIANTS,
  PRODUCT_NAME_MAX,
  removeVariantRow,
  resolveProductFormCopy,
  snapshotFromProduct,
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
  const queryClient = useQueryClient();
  const productId =
    args.mode === "edit" ? productIdFromParam(args.idParam) : null;
  const canWrite =
    args.mode === "create"
      ? canCreateProducts(membership.role)
      : canEditProducts(membership.role);

  const [draft, setDraft] = useState<ProductFormDraft>(emptyProductFormDraft);
  const [baseline, setBaseline] = useState<ProductFormSnapshot | null>(null);
  const [clientErrors, setClientErrors] =
    useState<ProductFormFieldErrors>(emptyFieldErrors);
  const [localBanner, setLocalBanner] = useState<BannerKey | null>(null);
  const [lastWrite, setLastWrite] = useState<ProductFormWrite | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const lastWriteRef = useRef(lastWrite);
  lastWriteRef.current = lastWrite;
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

  function changeVariantName(key: string, value: string): void {
    const next = patchDraft(draftRef.current, {
      variantKey: key,
      variantName: value,
    });
    draftRef.current = next;
    setDraft(next);
    clearAttempt();
  }

  function changeVariantPrice(key: string, value: string): void {
    const next = patchDraft(draftRef.current, {
      variantKey: key,
      variantPriceText: value,
    });
    draftRef.current = next;
    setDraft(next);
    clearAttempt();
  }

  function addVariant(): void {
    if (draftRef.current.variants.length >= PRODUCT_FORM_MAX_VARIANTS) {
      setLocalBanner("too_many_variants");
      return;
    }
    const next = addVariantRow(draftRef.current);
    draftRef.current = next;
    setDraft(next);
    clearAttempt();
  }

  function removeVariant(key: string): void {
    const next = removeVariantRow(draftRef.current, key);
    draftRef.current = next;
    setDraft(next);
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
    submitDisabled: resolved.submitDisabled || loadState.kind !== "ready",
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    canAddVariant:
      resolved.fieldsEditable &&
      loadState.kind === "ready" &&
      draft.variants.length < PRODUCT_FORM_MAX_VARIANTS,
    nameMaxLength: PRODUCT_NAME_MAX,
    headerTitle,
    goBack: () => {
      router.back();
    },
    retry: () => {
      void query.refetch();
    },
    changeName,
    changePrice,
    changeVariantName,
    changeVariantPrice,
    addVariant,
    removeVariant,
    save: () => {
      void save();
    },
  };
}
