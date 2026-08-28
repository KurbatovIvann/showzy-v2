import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import { getCustomerQueryOptions } from "../api/customer-detail-query";
import { counterpartyCountLabel } from "../shared/counterparty-count";
import { customerIdFromParam } from "../shared/customer-id";
import {
  canCreateCustomers,
  canDeleteCustomers,
  canEditCustomers,
} from "../shared/customer-permissions";
import {
  fieldErrorsFromFormState,
  mapCustomerFormFailure,
  mapValidationIssues,
  resolveCustomerFormCopy,
  rhfPathsForFieldErrors,
} from "./customer-form-copy";
import {
  cloneCustomerFormDraft,
  customerFormFieldChanged,
  draftFromCustomer,
  emptyCustomerFormDraft,
  snapshotFromCustomer,
  type CustomerFormDraft,
  type CustomerFormMode,
  type CustomerFormSnapshot,
} from "./customer-form-draft";
import { classifyCustomerFormLoad } from "./customer-form-load";
import {
  counterpartiesBodyCopy,
  counterpartiesBodyKind,
  groupAssignedPriceListId,
  inheritedPriceListPlaceholder,
  selectorLookupValue,
} from "./customer-form-pickers";
import { customerFormResolver } from "./customer-form.schema";
import { useCustomerFormLifecycle } from "./use-customer-form-lifecycle";
import { useCustomerFormLookups } from "./use-customer-form-lookups";
import { useCustomerSave } from "./use-customer-save";
import { useUnsavedCustomerGuard } from "./use-unsaved-customer-guard";

export type CustomerFormModel = ReturnType<typeof useCustomerForm>;

export type CustomerFormPicker = "group" | "priceList" | null;

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

  const { armLeave, requestLeave } = useUnsavedCustomerGuard({
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
    phoneMessage: errors.phone?.message,
    emailMessage: errors.email?.message,
    notesMessage: errors.notes?.message,
    server: serverFields,
  });
  const mappedBanner = mapCustomerFormFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const pending = saveApi.pending || lifecycle.pending;
  const resolved = resolveCustomerFormCopy(formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    phoneError: fieldErrors.phone,
    emailError: fieldErrors.email,
    notesError: fieldErrors.notes,
    contactError: fieldErrors.contact,
    banner: mappedBanner,
    pending,
    clientReady,
  });

  function onFieldEdit(): void {
    clearErrors();
    saveApi.resetMutation();
  }

  const archived = query.data?.status === "archived";
  const linkedCount = query.data?.linkedCounterpartyCount ?? 0;
  const counterpartiesKind = counterpartiesBodyKind(args.mode, linkedCount);
  const groupPriceListId = groupAssignedPriceListId(
    groupId,
    lookups.priceListIdByGroupId,
  );
  const headerTitle =
    args.mode === "create"
      ? copy.editorStub.clientCreateTitle
      : copy.editorStub.clientEditTitle;

  return {
    copy,
    mode: args.mode,
    control,
    originName: origin.name,
    originPhone: origin.phone,
    originEmail: origin.email,
    originNotes: origin.notes,
    state: loadState,
    nameError: resolved.nameError,
    phoneError: resolved.phoneError ?? resolved.contactError,
    emailError: resolved.emailError,
    notesError: resolved.notesError,
    banner: lifecycle.banner ?? resolved.banner,
    pending,
    submitDisabled:
      resolved.submitDisabled ||
      loadState.kind !== "ready" ||
      (args.mode === "edit" && !isDirty),
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    headerTitle,
    picker,
    groupId,
    priceListId,
    groupValue: selectorLookupValue(
      groupId,
      lookups.groupNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListValue: selectorLookupValue(
      priceListId,
      lookups.priceListNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListPlaceholder: inheritedPriceListPlaceholder({
      groupPriceListId,
      inheritGroup: formCopy.priceListInheritGroup,
      retailDefault: formCopy.priceListDefault,
    }),
    groupChanged: customerFormFieldChanged(args.mode, groupId, origin.groupId),
    priceListChanged: customerFormFieldChanged(
      args.mode,
      priceListId,
      origin.priceListId,
    ),
    groupOptions: lookups.groupOptions,
    priceListOptions: lookups.priceListOptions,
    archived,
    archivedLabel: copy.archivedBadge,
    showArchive: args.mode === "edit" && !archived && canWrite,
    showRestore: args.mode === "edit" && archived && canWrite,
    showDelete: args.mode === "edit" && archived && canDelete,
    counterpartiesKind,
    counterpartiesBodyText: counterpartiesBodyCopy({
      kind: counterpartiesKind,
      createHint: formCopy.counterpartiesCreateHint,
      empty: formCopy.counterpartiesEmpty,
      countLabel:
        counterpartiesKind === "count"
          ? counterpartyCountLabel(linkedCount, locale, copy.counterparties)
          : null,
    }),
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
