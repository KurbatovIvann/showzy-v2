import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { LIST_PRODUCTS_QUERY_MAX_LENGTH } from "@showzy/validation/catalog";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale, interpolate } from "../../../i18n/locale";
import { pricingCopy } from "../../../i18n/pricing";
import {
  getCatalogProductQueryOptions,
  listAllCatalogProductsQueryOptions,
} from "../api/catalog-products-query";
import { getPriceListQueryOptions } from "../api/price-list-detail-query";
import { listAllPriceListEntriesQueryOptions } from "../api/price-list-entries-query";
import { canManagePriceLists } from "../shared/price-list-permissions";
import { priceListEditorHref } from "../shared/price-list-hrefs";
import { priceListIdFromParam } from "../shared/price-list-id";
import {
  entryMessagesFromRhfRows,
  fieldErrorsFromFormState,
  mapPriceListFormFailure,
  mapValidationIssues,
  resolvePriceListFormCopy,
  rhfPathsForFieldErrors,
  entryPriceRhfPath,
} from "./price-list-form-copy";
import {
  applyBulkPercentOff,
  blocksDeactivateWhenDefault,
  clonePriceListFormDraft,
  draftFromPriceList,
  emptyPriceListFormDraft,
  isPriceListFormDirty,
  mergeExpandedVariants,
  originPriceTextByKey,
  parseBulkPercent,
  snapshotFromPriceList,
  storedEntryMap,
  type PriceListFormDraft,
  type PriceListFormMode,
  type PriceListFormSnapshot,
  type PriceListVariantMeta,
} from "./price-list-form-draft";
import {
  classifyPriceListFormLoad,
  combinePriceListFormQueries,
} from "./price-list-form-load";
import {
  catalogProductsForForm,
  storedEntriesForForm,
  variantsFromGetProduct,
  visiblePriceEntries,
} from "./price-list-form-rows";
import { priceListFormResolver } from "./price-list-form.schema";
import { usePriceListSave } from "./use-price-list-save";
import { useUnsavedPriceListGuard } from "./use-unsaved-price-list-guard";

export type PriceListFormModel = ReturnType<typeof usePriceListForm>;

export function usePriceListForm(args: {
  readonly mode: PriceListFormMode;
  readonly idParam?: string | string[];
}) {
  const copy = pricingCopy(detectLocale());
  const formCopy = copy.form;
  const router = useRouter();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canManage = canManagePriceLists(membership.role);
  const routePriceListId =
    args.mode === "edit" ? priceListIdFromParam(args.idParam) : null;

  const {
    control,
    reset,
    getValues,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState,
  } = useForm<PriceListFormDraft>({
    defaultValues: emptyPriceListFormDraft(),
    resolver: priceListFormResolver,
    mode: "onSubmit",
  });
  const { fields, append } = useFieldArray({
    control,
    name: "entries",
  });
  const { errors, isSubmitted } = formState;
  const isDefault = useWatch({ control, name: "isDefault" });

  const [origin, setOriginDraft] = useState<PriceListFormDraft>(
    emptyPriceListFormDraft,
  );
  const [baseline, setBaseline] = useState<PriceListFormSnapshot | null>(null);
  const [localBanner, setLocalBanner] = useState<string | null>(null);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [bulkPercent, setBulkPercent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [expandedProductIds, setExpandedProductIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [expandingProductIds, setExpandingProductIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [variantMeta, setVariantMeta] = useState<
    ReadonlyMap<string, PriceListVariantMeta>
  >(() => new Map());

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const originRef = useRef(origin);
  originRef.current = origin;
  const priceListIdRef = useRef(routePriceListId);
  if (routePriceListId !== null) {
    priceListIdRef.current = routePriceListId;
  }
  const hydratedIdRef = useRef<string | null>(null);
  const armLeaveRef = useRef(() => {});

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const editEnabled =
    args.mode === "edit" &&
    canManage &&
    clientReady &&
    routePriceListId !== null;
  const getActiveCompany = () => apiClient?.getActiveCompany() ?? null;

  const listQuery = useQuery(
    getPriceListQueryOptions({
      client: editEnabled ? apiClient : null,
      companyId: activeCompanyId,
      priceListId: routePriceListId,
      getActiveCompany,
    }),
  );
  const entriesQuery = useQuery(
    listAllPriceListEntriesQueryOptions({
      client: editEnabled ? apiClient : null,
      companyId: activeCompanyId,
      priceListId: routePriceListId,
      getActiveCompany,
    }),
  );
  const catalogQuery = useQuery(
    listAllCatalogProductsQueryOptions({
      client: editEnabled ? apiClient : null,
      companyId: activeCompanyId,
      enabled: editEnabled,
      getActiveCompany,
    }),
  );

  const catalogProducts = useMemo(
    () => catalogProductsForForm(catalogQuery.data ?? []),
    [catalogQuery.data],
  );
  const stored = useMemo(
    () => storedEntryMap(storedEntriesForForm(entriesQuery.data ?? [])),
    [entriesQuery.data],
  );
  const storedRef = useRef(stored);
  storedRef.current = stored;

  useEffect(() => {
    if (args.mode !== "edit" || listQuery.data === undefined) {
      return;
    }
    if (catalogQuery.data === undefined || entriesQuery.data === undefined) {
      return;
    }
    if (hydratedIdRef.current === listQuery.data.id) {
      return;
    }
    hydratedIdRef.current = listQuery.data.id;
    const products = catalogProductsForForm(catalogQuery.data);
    const next = draftFromPriceList({
      name: listQuery.data.name,
      isDefault: listQuery.data.isDefault,
      isActive: listQuery.data.isActive,
      products,
      stored: storedEntryMap(storedEntriesForForm(entriesQuery.data)),
    });
    const snap = snapshotFromPriceList({
      name: listQuery.data.name,
      isDefault: listQuery.data.isDefault,
      isActive: listQuery.data.isActive,
      products,
      stored: storedEntryMap(storedEntriesForForm(entriesQuery.data)),
    });
    reset(next);
    baselineRef.current = snap;
    originRef.current = next;
    setOriginDraft(next);
    setBaseline(snap);
  }, [args.mode, catalogQuery.data, entriesQuery.data, listQuery.data, reset]);

  useEffect(() => {
    function compute(): boolean {
      return isPriceListFormDirty(
        clonePriceListFormDraft(getValues()),
        originRef.current,
      );
    }
    setDirty(compute());
    const subscription = watch(() => {
      setDirty(compute());
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [getValues, origin, watch]);

  const combined = combinePriceListFormQueries([
    {
      status: listQuery.status,
      failureKind: listQuery.isError
        ? describeQueryFailure(listQuery.error).kind
        : null,
    },
    {
      status: entriesQuery.status,
      failureKind: entriesQuery.isError
        ? describeQueryFailure(entriesQuery.error).kind
        : null,
    },
    {
      status: catalogQuery.status,
      failureKind: catalogQuery.isError
        ? describeQueryFailure(catalogQuery.error).kind
        : null,
    },
  ]);
  const loadState = classifyPriceListFormLoad({
    mode: args.mode,
    canManage,
    priceListId: routePriceListId,
    clientReady,
    status: args.mode === "create" ? "success" : combined.status,
    failureKind: args.mode === "create" ? null : combined.failureKind,
  });

  const saveApi = usePriceListSave({
    mode: args.mode,
    canManage,
    loadKind: loadState.kind,
    getDraft: () => clonePriceListFormDraft(getValues()),
    setDraft: (_next) => {
      void _next;
    },
    setOrigin: (draft) => {
      reset(draft);
      originRef.current = draft;
      setOriginDraft(draft);
    },
    priceListIdRef,
    baselineRef,
    setBaseline,
    onSaved: () => {
      if (args.mode === "create") {
        const id = priceListIdRef.current;
        if (id !== null) {
          router.replace(priceListEditorHref(id));
        }
        return Promise.resolve();
      }
      armLeaveRef.current();
      return Promise.resolve();
    },
    setFieldErrors: (nextFieldErrors) => {
      for (const entry of rhfPathsForFieldErrors(
        nextFieldErrors,
        getValues().entries,
      )) {
        setError(entry.name, { type: "validate", message: entry.message });
      }
    },
  });

  const { armLeave, requestLeave } = useUnsavedPriceListGuard({
    dirty,
    pending: saveApi.pending,
    copy: formCopy,
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
  const fieldErrors = fieldErrorsFromFormState({
    submitted: isSubmitted,
    nameMessage: errors.name?.message,
    entryMessages: entryMessagesFromRhfRows(
      getValues().entries,
      errors.entries,
    ),
    server: serverFields,
  });
  const mappedBanner = mapPriceListFormFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const pending = saveApi.pending;
  const resolved = resolvePriceListFormCopy(formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    hasPriceError: Object.keys(fieldErrors.entries).length > 0,
    banner: mappedBanner,
    pending,
    clientReady,
  });

  function onFieldEdit(): void {
    clearErrors();
    setLocalBanner(null);
    saveApi.resetMutation();
  }

  const originPrices = originPriceTextByKey(origin);
  const priceRows = visiblePriceEntries({
    products: catalogProducts,
    fields: fields.map((field) => ({
      key: field.key,
      productId: field.productId,
      variantId: field.variantId,
    })),
    query: productSearch,
    expandedProductIds,
    expandingProductIds,
    variantMeta,
  });

  const headerTitle =
    args.mode === "create" ? formCopy.createTitle : formCopy.editTitle;

  return {
    copy,
    mode: args.mode,
    control,
    originName: origin.name,
    isDefault,
    productSearch,
    productSearchMaxLength: LIST_PRODUCTS_QUERY_MAX_LENGTH,
    bulkPercent,
    bulkNote,
    priceRows,
    state: loadState,
    nameError: resolved.nameError,
    banner: localBanner ?? resolved.banner,
    pending,
    submitDisabled:
      resolved.submitDisabled ||
      loadState.kind !== "ready" ||
      (args.mode === "edit" && !dirty),
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    headerTitle,
    originPriceText: (entryKey: string) => originPrices.get(entryKey) ?? "",
    entryError: (entryKey: string) =>
      fieldErrors.entries[entryKey] === "invalid"
        ? formCopy.errors.priceInvalid
        : null,
    onFieldEdit,
    changeProductSearch: setProductSearch,
    changeBulkPercent: (value: string) => {
      setBulkPercent(value);
      setBulkNote(null);
    },
    onDefaultChange: (checked: boolean) => {
      setValue("isDefault", checked, { shouldDirty: true });
      if (checked) {
        setValue("isActive", true, { shouldDirty: true });
      }
      onFieldEdit();
    },
    onActiveChange: (checked: boolean) => {
      if (
        blocksDeactivateWhenDefault({
          isDefault: getValues().isDefault,
          nextActive: checked,
        })
      ) {
        setLocalBanner(copy.toast.cannotDeactivateDefault);
        return;
      }
      setValue("isActive", checked, { shouldDirty: true });
      onFieldEdit();
    },
    applyBulk: () => {
      const parsed = parseBulkPercent(bulkPercent);
      if (!parsed.ok) {
        setLocalBanner(formCopy.bulkInvalid);
        setBulkNote(null);
        return;
      }
      const next = applyBulkPercentOff({
        draft: clonePriceListFormDraft(getValues()),
        percent: parsed.percent,
        basePriceMinorByProductId: new Map(
          catalogProducts.map((product) => [
            product.id,
            product.basePriceMinor,
          ]),
        ),
      });
      next.entries.forEach((entry, index) => {
        if (entry.variantId !== null) {
          return;
        }
        setValue(entryPriceRhfPath(index), entry.priceText, {
          shouldDirty: true,
        });
      });
      setBulkPercent("");
      setLocalBanner(null);
      setBulkNote(
        interpolate(formCopy.bulkApplied, {
          percent: String(parsed.percent),
        }),
      );
    },
    toggleExpand: (productId: string) => {
      if (expandedProductIds.has(productId)) {
        setExpandedProductIds((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
        return;
      }
      if (apiClient === null || expandingProductIds.has(productId)) {
        return;
      }
      const client = apiClient;
      setExpandingProductIds((current) => new Set(current).add(productId));
      void queryClient
        .fetchQuery(
          getCatalogProductQueryOptions({
            client,
            companyId: activeCompanyId,
            productId,
            getActiveCompany: () => client.getActiveCompany() ?? null,
          }),
        )
        .then((product) => {
          const variants = variantsFromGetProduct(product.variants);
          setVariantMeta((current) => {
            const next = new Map(current);
            for (const variant of variants) {
              next.set(variant.id, {
                name: variant.name,
                archived: variant.archived,
                basePriceMinor: variant.basePriceMinor,
              });
            }
            return next;
          });
          const merged = mergeExpandedVariants({
            draft: clonePriceListFormDraft(getValues()),
            origin: originRef.current,
            baseline: baselineRef.current,
            productId,
            variants,
            stored: storedRef.current,
          });
          const existing = new Set(
            getValues().entries.map((entry) => entry.key),
          );
          for (const entry of merged.draft.entries) {
            if (!existing.has(entry.key)) {
              append(entry, { shouldFocus: false });
            }
          }
          originRef.current = merged.origin;
          setOriginDraft(merged.origin);
          baselineRef.current = merged.baseline;
          setBaseline(merged.baseline);
          setExpandedProductIds((current) => new Set(current).add(productId));
        })
        .catch(() => {
          setLocalBanner(formCopy.errors.unavailable);
        })
        .finally(() => {
          setExpandingProductIds((current) => {
            const next = new Set(current);
            next.delete(productId);
            return next;
          });
        });
    },
    requestLeave,
    retry: () => {
      void listQuery.refetch();
      void entriesQuery.refetch();
      void catalogQuery.refetch();
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
