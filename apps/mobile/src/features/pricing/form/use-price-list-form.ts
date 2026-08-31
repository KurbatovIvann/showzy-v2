/**
 * Price-list editor composer (SHO-304). Hydrate + RHF + save
 * orchestration. Queries, dirty, variant expand, and row derivation
 * live in sibling hooks/modules.
 */
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { LIST_PRODUCTS_QUERY_MAX } from "@showzy/validation/catalog";

import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useUnsavedGuard } from "../../../components/form-kit";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { detectLocale, interpolate } from "../../../i18n/locale";
import { pricingCopy } from "../../../i18n/pricing";
import { priceListEditorHref } from "../shared/price-list-hrefs";
import { priceListIdFromParam } from "../shared/price-list-id";
import { canManagePriceLists } from "../shared/price-list-permissions";
import { applyBulkPercentOff, parseBulkPercent } from "./price-list-form-bulk";
import {
  entryMessagesFromRhfRows,
  entryPriceRhfPath,
  fieldErrorsFromFormState,
  mapPriceListFormFailure,
  mapValidationIssues,
  resolvePriceListFormCopy,
  rhfPathsForFieldErrors,
} from "./price-list-form-copy";
import {
  blocksDeactivateWhenDefault,
  clonePriceListFormDraft,
  emptyPriceListFormDraft,
  type PriceListFormDraft,
  type PriceListFormMode,
} from "./price-list-form-draft";
import {
  presentPriceListFormHeader,
  presentPriceListFormRows,
} from "./price-list-form.presenter";
import { priceListFormResolver } from "./price-list-form.schema";
import { usePriceListFormDirty } from "./use-price-list-form-dirty";
import { usePriceListFormHydrate } from "./use-price-list-form-hydrate";
import { usePriceListFormQueries } from "./use-price-list-form-queries";
import { usePriceListSave } from "./use-price-list-save";
import { useVariantExpansion } from "./use-variant-expansion";

export type PriceListFormModel = ReturnType<typeof usePriceListForm>;

export function usePriceListForm(args: {
  readonly mode: PriceListFormMode;
  readonly idParam?: string | string[];
}) {
  const locale = detectLocale();
  const copy = useMemo(() => pricingCopy(locale), [locale]);
  const formCopy = copy.form;
  const router = useRouter();
  const membership = useResolvedCompany();
  const canManage = canManagePriceLists(membership.role);
  const routePriceListId =
    args.mode === "edit" ? priceListIdFromParam(args.idParam) : null;
  const queries = usePriceListFormQueries({
    mode: args.mode,
    canManage,
    routePriceListId,
  });
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
  const { fields, append } = useFieldArray({ control, name: "entries" });
  const { errors, isSubmitted } = formState;
  const isDefault = useWatch({ control, name: "isDefault" });
  const origin = usePriceListFormHydrate({
    mode: args.mode,
    reset,
    listData: queries.listData,
    catalogData: queries.catalogData,
    entriesData: queries.entriesData,
  });

  const priceListIdRef = useRef(routePriceListId);
  if (routePriceListId !== null) {
    priceListIdRef.current = routePriceListId;
  }
  const armLeaveRef = useRef(() => {});
  const [localBanner, setLocalBanner] = useState<string | null>(null);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [bulkPercent, setBulkPercent] = useState("");

  const dirty = usePriceListFormDirty({
    watch,
    getValues,
    originRef: origin.originRef,
    originTick: origin.originTick,
  });
  const saveApi = usePriceListSave({
    mode: args.mode,
    canManage,
    loadKind: queries.loadState.kind,
    getDraft: () => clonePriceListFormDraft(getValues()),
    setOrigin: (draft) => {
      reset(draft);
      origin.commitOrigin(draft);
    },
    priceListIdRef,
    baselineRef: origin.baselineRef,
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
  const { armLeave, requestLeave } = useUnsavedGuard({
    dirty,
    pending: saveApi.pending,
    copy: formCopy,
  });
  armLeaveRef.current = armLeave;
  const expansion = useVariantExpansion({
    apiClient: queries.apiClient,
    activeCompanyId: queries.activeCompanyId,
    getValues,
    originDraftRef: origin.originDraftRef,
    baselineRef: origin.baselineRef,
    storedRef: queries.storedRef,
    append,
    commitOrigin: origin.commitOrigin,
    commitBaseline: origin.commitBaseline,
    onUnavailable: () => {
      setLocalBanner(formCopy.errors.unavailable);
    },
  });

  const failure = saveApi.isMutationError
    ? describeQueryFailure(saveApi.mutationError)
    : null;
  const wire = saveApi.isMutationError
    ? describeWireError(saveApi.mutationError)
    : null;
  const fieldErrors = fieldErrorsFromFormState({
    submitted: isSubmitted,
    nameMessage: errors.name?.message,
    entryMessages: entryMessagesFromRhfRows(fields, errors.entries),
    server: saveApi.isMutationError
      ? mapValidationIssues(saveApi.mutationError, saveApi.lastWrite)
      : null,
  });
  const resolved = resolvePriceListFormCopy(formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    hasPriceError: Object.keys(fieldErrors.entries).length > 0,
    banner: mapPriceListFormFailure(failure?.kind ?? null, wire?.code ?? null),
    pending: saveApi.pending,
    clientReady: queries.clientReady,
  });

  const clearOnEditRef = useRef({
    hasErrors: false,
    isMutationError: false,
    hasBanner: false,
  });
  clearOnEditRef.current = {
    hasErrors: Boolean(errors.name) || Boolean(errors.entries),
    isMutationError: saveApi.isMutationError,
    hasBanner: localBanner !== null,
  };
  const resetMutation = saveApi.resetMutation;
  const onFieldEdit = useCallback(() => {
    const next = clearOnEditRef.current;
    if (next.hasBanner) {
      setLocalBanner(null);
    }
    if (next.hasErrors) {
      clearErrors();
    }
    if (next.isMutationError) {
      resetMutation();
    }
  }, [clearErrors, resetMutation]);

  const fieldRows = useMemo(
    () =>
      fields.map((field) => ({
        key: field.key,
        productId: field.productId,
        variantId: field.variantId,
      })),
    [fields],
  );
  const priceRows = useMemo(
    () =>
      presentPriceListFormRows({
        products: queries.catalogProducts,
        fields: fieldRows,
        query: productSearch,
        expandedProductIds: expansion.state.expandedProductIds,
        expandingProductIds: expansion.state.expandingProductIds,
        variantMeta: expansion.state.variantMeta,
        origin: origin.originRef.current,
        entryErrors: fieldErrors.entries,
        priceInvalidCopy: formCopy.errors.priceInvalid,
      }),
    [
      expansion.state,
      fieldErrors.entries,
      fieldRows,
      formCopy.errors.priceInvalid,
      origin.originTick,
      productSearch,
      queries.catalogProducts,
    ],
  );

  return {
    copy,
    mode: args.mode,
    control,
    originName: origin.originName,
    isDefault,
    productSearch,
    productSearchMaxLength: LIST_PRODUCTS_QUERY_MAX,
    bulkPercent,
    bulkNote,
    priceRows,
    state: queries.loadState,
    nameError: resolved.nameError,
    banner: localBanner ?? resolved.banner,
    pending: saveApi.pending,
    submitDisabled:
      resolved.submitDisabled ||
      queries.loadState.kind !== "ready" ||
      (args.mode === "edit" && !dirty),
    submitLabel: resolved.submitLabel,
    fieldsEditable:
      resolved.fieldsEditable && queries.loadState.kind === "ready",
    headerTitle: presentPriceListFormHeader(args.mode, formCopy),
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
        setLocalBanner(formCopy.cannotDeactivateDefault);
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
        draft: getValues(),
        percent: parsed.percent,
        basePriceMinorByProductId: new Map(
          queries.catalogProducts.map((product) => [
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
        interpolate(formCopy.bulkApplied, { percent: String(parsed.percent) }),
      );
    },
    toggleExpand: expansion.toggleExpand,
    requestLeave,
    retry: queries.retry,
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
