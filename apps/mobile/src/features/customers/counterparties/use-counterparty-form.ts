import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import { getCounterpartyQueryOptions } from "../api/counterparty-detail-query";
import { selectorLookupValue } from "../form/customer-form-pickers";
import { customerEditorHref } from "../shared/customer-hrefs";
import { customerIdFromParam } from "../shared/customer-id";
import { canEditCustomers } from "../shared/customer-permissions";
import {
  fieldErrorsFromFormState,
  mapCounterpartyFormFailure,
  mapValidationIssues,
  resolveCounterpartyFormCopy,
  rhfPathsForFieldErrors,
} from "./counterparty-form-copy";
import {
  cloneCounterpartyFormDraft,
  counterpartyFormFieldChanged,
  draftFromCounterparty,
  emptyCounterpartyFormDraft,
  snapshotFromCounterparty,
  type CounterpartyFormDraft,
  type CounterpartyFormMode,
  type CounterpartyFormSnapshot,
} from "./counterparty-form-draft";
import { classifyCounterpartyFormLoad } from "./counterparty-form-load";
import {
  ensureLinkedCustomerOption,
  linkedCustomerName,
} from "./counterparty-form-options";
import { counterpartyFormResolver } from "./counterparty-form.schema";
import { useCounterpartyFormLifecycle } from "./use-counterparty-form-lifecycle";
import { useCounterpartyFormLookups } from "./use-counterparty-form-lookups";
import { useCounterpartySave } from "./use-counterparty-save";
import { useUnsavedCounterpartyGuard } from "./use-unsaved-counterparty-guard";

export type CounterpartyFormModel = ReturnType<typeof useCounterpartyForm>;

export function useCounterpartyForm(args: {
  readonly mode: CounterpartyFormMode;
  readonly idParam?: string | string[];
  readonly customerIdParam?: string | string[];
}) {
  const locale = detectLocale();
  const copy = customersCopy(locale);
  const formCopy = copy.counterpartyForm;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const router = useRouter();
  const createPrefillId =
    args.mode === "create" ? customerIdFromParam(args.customerIdParam) : null;
  const routeCounterpartyId =
    args.mode === "edit" ? customerIdFromParam(args.idParam) : null;
  const canWrite = canEditCustomers(membership.role);

  const {
    control,
    reset,
    getValues,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    formState,
  } = useForm<CounterpartyFormDraft>({
    defaultValues: emptyCounterpartyFormDraft(createPrefillId),
    resolver: counterpartyFormResolver,
    mode: "onSubmit",
  });
  const { isDirty, errors, isSubmitted } = formState;

  const [origin, setOriginDraft] = useState<CounterpartyFormDraft>(() =>
    emptyCounterpartyFormDraft(createPrefillId),
  );
  const [baseline, setBaseline] = useState<CounterpartyFormSnapshot | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const counterpartyIdRef = useRef(routeCounterpartyId);
  if (routeCounterpartyId !== null) {
    counterpartyIdRef.current = routeCounterpartyId;
  }
  const hydratedIdRef = useRef<string | null>(null);

  const query = useQuery(
    getCounterpartyQueryOptions({
      client: canWrite ? apiClient : null,
      companyId: activeCompanyId,
      counterpartyId: routeCounterpartyId,
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
    const next = draftFromCounterparty(query.data);
    const snap = snapshotFromCounterparty(query.data);
    reset(next);
    baselineRef.current = snap;
    setOriginDraft(next);
    setBaseline(snap);
  }, [args.mode, query.data, reset]);

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyCounterpartyFormLoad({
    mode: args.mode,
    canWrite,
    counterpartyId: routeCounterpartyId,
    clientReady,
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
  });

  const lookups = useCounterpartyFormLookups({
    enabled: canWrite && clientReady,
    prefillCustomerId: createPrefillId,
  });

  const customerId = useWatch({ control, name: "customerId" }) ?? null;

  const armLeaveRef = useRef(() => {});

  const saveApi = useCounterpartySave({
    mode: args.mode,
    loadKind: loadState.kind,
    getDraft: () => cloneCounterpartyFormDraft(getValues()),
    setDraft: (next) => {
      reset(next);
    },
    setOrigin: (draft) => {
      reset(draft);
      setOriginDraft(draft);
    },
    counterpartyIdRef,
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

  const { armLeave, requestLeave } = useUnsavedCounterpartyGuard({
    dirty: isDirty,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen: pickerOpen,
    closeSheet: () => {
      setPickerOpen(false);
    },
  });
  armLeaveRef.current = armLeave;

  const lifecycle = useCounterpartyFormLifecycle({
    copy,
    canEdit: canWrite,
    counterpartyId: args.mode === "edit" ? routeCounterpartyId : null,
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
    edrpouMessage: errors.edrpou?.message,
    legalAddressMessage: errors.legalAddress?.message,
    ibanMessage: errors.iban?.message,
    bankNameMessage: errors.bankName?.message,
    bankMfoMessage: errors.bankMfo?.message,
    phoneMessage: errors.phone?.message,
    emailMessage: errors.email?.message,
    notesMessage: errors.notes?.message,
    server: serverFields,
  });
  const mappedBanner = mapCounterpartyFormFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const pending = saveApi.pending || lifecycle.pending;
  const resolved = resolveCounterpartyFormCopy(formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    edrpouError: fieldErrors.edrpou,
    legalAddressError: fieldErrors.legalAddress,
    ibanError: fieldErrors.iban,
    bankNameError: fieldErrors.bankName,
    bankMfoError: fieldErrors.bankMfo,
    phoneError: fieldErrors.phone,
    emailError: fieldErrors.email,
    notesError: fieldErrors.notes,
    banner: mappedBanner,
    pending,
    clientReady,
  });

  function onFieldEdit(): void {
    clearErrors();
    saveApi.resetMutation();
  }

  const headerTitle =
    args.mode === "create"
      ? copy.editorStub.counterpartyCreateTitle
      : copy.editorStub.counterpartyEditTitle;
  const linkedName = linkedCustomerName({
    fromCounterparty: query.data?.customerName,
    fromPrefillCustomer: lookups.prefillCustomerName,
  });
  const customerOptions = ensureLinkedCustomerOption({
    options: lookups.customerOptions,
    customerId,
    customerName: linkedName,
    unnamedFallback: formCopy.assignmentUnavailable,
  });

  return {
    copy,
    mode: args.mode,
    control,
    originName: origin.name,
    originEdrpou: origin.edrpou,
    originLegalAddress: origin.legalAddress,
    originIban: origin.iban,
    originBankName: origin.bankName,
    originBankMfo: origin.bankMfo,
    originPhone: origin.phone,
    originEmail: origin.email,
    originNotes: origin.notes,
    state: loadState,
    nameError: resolved.nameError,
    edrpouError: resolved.edrpouError,
    legalAddressError: resolved.legalAddressError,
    ibanError: resolved.ibanError,
    bankNameError: resolved.bankNameError,
    bankMfoError: resolved.bankMfoError,
    phoneError: resolved.phoneError,
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
    pickerOpen,
    customerId,
    customerValue: selectorLookupValue(
      customerId,
      lookups.customerNameById,
      linkedName ?? formCopy.assignmentUnavailable,
    ),
    customerChanged: counterpartyFormFieldChanged(
      args.mode,
      customerId,
      origin.customerId,
    ),
    customerOptions,
    showOpenClient: customerId !== null,
    showDelete: args.mode === "edit" && canWrite,
    onFieldEdit,
    requestLeave,
    openCustomerPicker: () => {
      setPickerOpen(true);
    },
    closePicker: () => {
      setPickerOpen(false);
    },
    selectCustomer: (id: string | null) => {
      setValue("customerId", id, { shouldDirty: true });
      onFieldEdit();
    },
    openClient: () => {
      if (customerId === null) {
        return;
      }
      router.push(customerEditorHref(customerId));
    },
    retry: () => {
      void query.refetch();
    },
    remove: lifecycle.remove,
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
