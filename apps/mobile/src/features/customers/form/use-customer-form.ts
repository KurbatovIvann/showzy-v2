import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useUnsavedGuard } from "../../../components/form-kit";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import { getCustomerQueryOptions } from "../api/customer-detail-query";
import {
  counterpartyCreateHref,
  counterpartyEditorHref,
} from "../shared/customer-hrefs";
import { customerIdFromParam } from "../shared/customer-id";
import {
  canCreateCustomers,
  canDeleteCustomers,
  canEditCustomers,
} from "../shared/customer-permissions";
import { rhfPathsForFieldErrors } from "./customer-form-copy";
import {
  cloneCustomerFormDraft,
  draftFromCustomer,
  emptyCustomerFormDraft,
  snapshotFromCustomer,
  type CustomerFormDraft,
  type CustomerFormMode,
  type CustomerFormSnapshot,
} from "./customer-form-draft";
import { classifyCustomerFormLoad } from "./customer-form-load";
import {
  presentCustomerFormCopy,
  presentCustomerFormView,
  type CustomerFormPicker,
} from "./customer-form.presenter";
import { customerFormResolver } from "./customer-form.schema";
import { useCustomerFormLifecycle } from "./use-customer-form-lifecycle";
import { useCustomerFormLookups } from "./use-customer-form-lookups";
import { useCustomerLinkedCounterparties } from "./use-customer-linked-counterparties";
import { useCustomerSave } from "./use-customer-save";

export type { CustomerFormPicker };

export type CustomerFormModel = ReturnType<typeof useCustomerForm>;

export function useCustomerForm(args: {
  readonly mode: CustomerFormMode;
  readonly idParam?: string | string[];
}) {
  const locale = detectLocale();
  const copy = customersCopy(locale);
  const formCopy = copy.form;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const routeCustomerId =
    args.mode === "edit" ? customerIdFromParam(args.idParam) : null;
  const canWrite =
    args.mode === "create"
      ? canCreateCustomers(membership.role)
      : canEditCustomers(membership.role);
  const canDelete = canDeleteCustomers(membership.role);

  const {
    control,
    reset,
    getValues,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    formState,
  } = useForm<CustomerFormDraft>({
    defaultValues: emptyCustomerFormDraft(),
    resolver: customerFormResolver,
    mode: "onSubmit",
  });
  const { isDirty, errors, isSubmitted } = formState;

  const [origin, setOriginDraft] = useState<CustomerFormDraft>(
    emptyCustomerFormDraft,
  );
  const [baseline, setBaseline] = useState<CustomerFormSnapshot | null>(null);
  const [picker, setPicker] = useState<CustomerFormPicker>(null);

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const customerIdRef = useRef(routeCustomerId);
  if (routeCustomerId !== null) {
    customerIdRef.current = routeCustomerId;
  }
  const hydratedIdRef = useRef<string | null>(null);

  const query = useQuery(
    getCustomerQueryOptions({
      client: canWrite ? apiClient : null,
      companyId: activeCompanyId,
      customerId: routeCustomerId,
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
    const next = draftFromCustomer(query.data);
    const snap = snapshotFromCustomer(query.data);
    reset(next);
    baselineRef.current = snap;
    setOriginDraft(next);
    setBaseline(snap);
  }, [args.mode, query.data, reset]);

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyCustomerFormLoad({
    mode: args.mode,
    canWrite,
    customerId: routeCustomerId,
    clientReady,
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
  });

  const lookups = useCustomerFormLookups({
    enabled: canWrite && clientReady,
  });
  const linkedCounterparties = useCustomerLinkedCounterparties({
    enabled: canWrite && clientReady && args.mode === "edit",
    customerId: routeCustomerId,
  });

  const groupId = useWatch({ control, name: "groupId" }) ?? null;
  const priceListId = useWatch({ control, name: "priceListId" }) ?? null;

  const armLeaveRef = useRef(() => {});

  const saveApi = useCustomerSave({
    mode: args.mode,
    loadKind: loadState.kind,
    getDraft: () => cloneCustomerFormDraft(getValues()),
    setDraft: (next) => {
      reset(next);
    },
    setOrigin: (draft) => {
      reset(draft);
      setOriginDraft(draft);
    },
    customerIdRef,
    baselineRef,
    setBaseline,
    onSaved: () => {
      armLeaveRef.current();
      return Promise.resolve();
    },
    setFieldErrors: (nextFieldErrors) => {
      for (const entry of rhfPathsForFieldErrors(nextFieldErrors)) {
        setError(entry.name, { type: "validate", message: entry.message });
      }
    },
  });

  const { armLeave, requestLeave } = useUnsavedGuard({
    dirty: isDirty,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen: picker !== null,
    closeSheet: () => {
      setPicker(null);
    },
  });
  armLeaveRef.current = armLeave;

  const lifecycle = useCustomerFormLifecycle({
    copy,
    canEdit: canWrite,
    canDelete,
    customerId: args.mode === "edit" ? routeCustomerId : null,
    armLeave,
  });

  const pending = saveApi.pending || lifecycle.pending;
  const resolved = presentCustomerFormCopy({
    formCopy,
    mode: args.mode,
    submitted: isSubmitted,
    nameMessage: errors.name?.message,
    phoneMessage: errors.phone?.message,
    emailMessage: errors.email?.message,
    notesMessage: errors.notes?.message,
    mutationError: saveApi.mutationError,
    lastWrite: saveApi.lastWrite,
    isMutationError: saveApi.isMutationError,
    pending,
    clientReady,
  });

  function onFieldEdit(): void {
    clearErrors();
    saveApi.resetMutation();
  }

  const presented = presentCustomerFormView({
    copy,
    mode: args.mode,
    origin,
    loadState,
    resolved,
    pending,
    isDirty,
    picker,
    groupId,
    priceListId,
    lookups,
    archived: query.data?.status === "archived",
    canWrite,
    canDelete,
    counterpartiesStatus: linkedCounterparties.status,
    linkedItems: linkedCounterparties.items,
    lifecycleBanner: lifecycle.banner,
  });

  return {
    copy,
    mode: args.mode,
    control,
    ...presented,
    onFieldEdit,
    requestLeave,
    openGroupPicker: () => {
      setPicker("group");
    },
    openPriceListPicker: () => {
      setPicker("priceList");
    },
    closePicker: () => {
      setPicker(null);
    },
    selectGroup: (id: string | null) => {
      setValue("groupId", id, { shouldDirty: true });
      onFieldEdit();
    },
    selectPriceList: (id: string | null) => {
      setValue("priceListId", id, { shouldDirty: true });
      onFieldEdit();
    },
    archive: lifecycle.archive,
    restore: lifecycle.restore,
    remove: lifecycle.remove,
    retry: () => {
      void query.refetch();
    },
    retryCounterparties: linkedCounterparties.retry,
    addCounterparty: () => {
      if (routeCustomerId === null) {
        return;
      }
      router.push(counterpartyCreateHref(routeCustomerId));
    },
    openCounterparty: (id: string) => {
      router.push(counterpartyEditorHref(id));
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
