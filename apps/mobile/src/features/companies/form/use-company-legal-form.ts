import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { MutationCallOptions } from "@showzy/contract";

import { useApiClient } from "../../../api/api-provider";
import type { ContractClient } from "../../../api/client";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useFormSave, useUnsavedGuard } from "../../../components/form-kit";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { companiesCopy } from "../../../i18n/companies";
import { detectLocale } from "../../../i18n/locale";
import { invalidateCompanyAfterWrite } from "../api/company-cache";
import { bindCompanyLegalFormMutate } from "../api/company-legal-form-mutation";
import { getCompanyQueryOptions } from "../api/company.queries";
import { canViewCompanySettings } from "../shared/company-permissions";
import {
  fieldErrorsFromFormState,
  mapCompanyLegalFormFailure,
  mapValidationIssues,
  resolveCompanyLegalFormCopy,
  rhfPathsForFieldErrors,
} from "./company-legal-form-copy";
import {
  cloneCompanyLegalFormDraft,
  companyLegalFormFieldChanged,
  companyTypeFromWatch,
  draftFromCompanyLegal,
  emptyCompanyLegalFormDraft,
  isCompanyLegalDraftEmpty,
  snapshotFromCompanyLegal,
  type CompanyLegalFormDraft,
  type CompanyLegalFormFieldErrors,
  type CompanyLegalFormSnapshot,
  type CompanyLegalType,
} from "./company-legal-form-draft";
import {
  classifyCompanyLegalFormLoad,
  companyLegalFormMode,
} from "./company-legal-form-load";
import {
  applyWriteSuccess,
  parseThenPlanCompanyLegalFormSave,
  type CompanyLegalFormMutationResult,
  type CompanyLegalFormWrite,
} from "./company-legal-form-plan";
import { companyLegalFormResolver } from "./company-legal-form.schema";

function bindCompanyLegalSave(
  client: ContractClient,
): (
  input: CompanyLegalFormWrite,
  options: MutationCallOptions,
) => Promise<CompanyLegalFormMutationResult> {
  return bindCompanyLegalFormMutate(client);
}

export type CompanyLegalFormModel = ReturnType<typeof useCompanyLegalForm>;

export function useCompanyLegalForm() {
  const locale = detectLocale();
  const copy = companiesCopy(locale);
  const formCopy = copy.legalForm;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const membership = useResolvedCompany();
  const canView = canViewCompanySettings(membership.role);

  const {
    control,
    reset,
    getValues,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    formState,
  } = useForm<CompanyLegalFormDraft>({
    defaultValues: emptyCompanyLegalFormDraft(),
    resolver: companyLegalFormResolver,
    mode: "onSubmit",
  });
  const { isDirty, errors, isSubmitted } = formState;
  const companyType = companyTypeFromWatch(
    useWatch({ control, name: "companyType" }),
  );
  const [
    legalNameValue,
    edrpouValue,
    legalAddressValue,
    ibanValue,
    bankNameValue,
    bankMfoValue,
    bankEdrpouValue,
    phoneValue,
    emailValue,
  ] = useWatch({
    control,
    name: [
      "legalName",
      "edrpou",
      "legalAddress",
      "iban",
      "bankName",
      "bankMfo",
      "bankEdrpou",
      "phone",
      "email",
    ],
  });
  const empty = isCompanyLegalDraftEmpty({
    companyType,
    legalName: legalNameValue,
    edrpou: edrpouValue,
    legalAddress: legalAddressValue,
    iban: ibanValue,
    bankName: bankNameValue,
    bankMfo: bankMfoValue,
    bankEdrpou: bankEdrpouValue,
    phone: phoneValue,
    email: emailValue,
  });

  const [origin, setOriginDraft] = useState<CompanyLegalFormDraft>(() =>
    emptyCompanyLegalFormDraft(),
  );
  const [baseline, setBaseline] = useState<CompanyLegalFormSnapshot | null>(
    null,
  );
  const [appliedCompanyId, setAppliedCompanyId] = useState<string | null>(null);

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const hydratedIdRef = useRef<string | null>(null);

  const query = useQuery(
    getCompanyQueryOptions({
      client: canView ? apiClient : null,
      companyId: activeCompanyId,
      getActiveCompany: () => apiClient?.getActiveCompany() ?? null,
      enabled: canView,
    }),
  );

  useEffect(() => {
    if (query.data === undefined) {
      return;
    }
    if (hydratedIdRef.current === query.data.id) {
      return;
    }
    hydratedIdRef.current = query.data.id;
    const next = draftFromCompanyLegal(query.data.legal);
    const snap = snapshotFromCompanyLegal(query.data.legal);
    reset(next);
    baselineRef.current = snap;
    setOriginDraft(next);
    setBaseline(snap);
    setAppliedCompanyId(query.data.id);
  }, [query.data, reset]);

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const hydrated =
    query.data !== undefined && appliedCompanyId === query.data.id;
  const loadState = classifyCompanyLegalFormLoad({
    canView,
    clientReady,
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
    hydrated,
  });
  const mode = companyLegalFormMode({
    legal: query.data?.legal,
    baseline,
  });

  const armLeaveRef = useRef(() => {});

  const saveApi = useFormSave<
    CompanyLegalFormDraft,
    CompanyLegalFormWrite,
    CompanyLegalFormMutationResult,
    CompanyLegalFormFieldErrors
  >({
    bindMutate: bindCompanyLegalSave,
    invalidate: () =>
      invalidateCompanyAfterWrite({
        queryClient,
        companyId: activeCompanyId,
      }),
    ready: loadState.kind === "ready",
    getDraft: () => cloneCompanyLegalFormDraft(getValues()),
    setOrigin: (draft) => {
      reset(draft);
      setOriginDraft(draft);
    },
    setFieldErrors: (nextFieldErrors) => {
      for (const entry of rhfPathsForFieldErrors(nextFieldErrors)) {
        setError(entry.name, { type: "validate", message: entry.message });
      }
    },
    plan: ({ lastWrite, lastFailure }) =>
      parseThenPlanCompanyLegalFormSave({
        mode,
        draft: cloneCompanyLegalFormDraft(getValues()),
        baseline: baselineRef.current,
        lastWrite,
        lastFailureKind: lastFailure.kind,
        lastWireCode: lastFailure.wire,
      }),
    applySuccess: ({ draft }) => {
      const applied = applyWriteSuccess({ draft });
      reset(applied.draft);
      baselineRef.current = applied.baseline;
      setBaseline(applied.baseline);
    },
    onSaved: () => {
      armLeaveRef.current();
      return Promise.resolve();
    },
  });

  const { armLeave, requestLeave } = useUnsavedGuard({
    dirty: isDirty,
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
    legalNameMessage: errors.legalName?.message,
    companyTypeMessage: errors.companyType?.message,
    edrpouMessage: errors.edrpou?.message,
    legalAddressMessage: errors.legalAddress?.message,
    ibanMessage: errors.iban?.message,
    bankNameMessage: errors.bankName?.message,
    bankMfoMessage: errors.bankMfo?.message,
    bankEdrpouMessage: errors.bankEdrpou?.message,
    phoneMessage: errors.phone?.message,
    emailMessage: errors.email?.message,
    server: serverFields,
  });
  const mappedBanner = mapCompanyLegalFormFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const pending = saveApi.pending;
  const resolved = resolveCompanyLegalFormCopy(formCopy, {
    mode,
    legalNameError: fieldErrors.legalName,
    companyTypeError: fieldErrors.companyType,
    edrpouError: fieldErrors.edrpou,
    legalAddressError: fieldErrors.legalAddress,
    ibanError: fieldErrors.iban,
    bankNameError: fieldErrors.bankName,
    bankMfoError: fieldErrors.bankMfo,
    bankEdrpouError: fieldErrors.bankEdrpou,
    phoneError: fieldErrors.phone,
    emailError: fieldErrors.email,
    banner: mappedBanner,
    pending,
    clientReady,
    empty,
    dirty: isDirty,
  });

  function onFieldEdit(): void {
    clearErrors();
    saveApi.resetMutation();
  }

  const typeTabs = useMemo(
    () =>
      [
        { key: "fop" as const, label: formCopy.typeFop },
        { key: "tov" as const, label: formCopy.typeTov },
      ] as const,
    [formCopy.typeFop, formCopy.typeTov],
  );

  return {
    copy,
    mode,
    control,
    originLegalName: origin.legalName,
    originEdrpou: origin.edrpou,
    originLegalAddress: origin.legalAddress,
    originIban: origin.iban,
    originBankName: origin.bankName,
    originBankMfo: origin.bankMfo,
    originBankEdrpou: origin.bankEdrpou,
    originPhone: origin.phone,
    originEmail: origin.email,
    state: loadState,
    companyType,
    companyTypeChanged: companyLegalFormFieldChanged(
      mode,
      companyType,
      origin.companyType,
    ),
    typeTabs,
    legalNameError: resolved.legalNameError,
    edrpouError: resolved.edrpouError,
    legalAddressError: resolved.legalAddressError,
    ibanError: resolved.ibanError,
    bankNameError: resolved.bankNameError,
    bankMfoError: resolved.bankMfoError,
    bankEdrpouError: resolved.bankEdrpouError,
    phoneError: resolved.phoneError,
    emailError: resolved.emailError,
    banner: resolved.banner,
    pending,
    submitDisabled:
      resolved.submitDisabled || loadState.kind !== "ready" || !canView,
    submitLabel: resolved.submitLabel,
    fieldsEditable:
      resolved.fieldsEditable && loadState.kind === "ready" && canView,
    onFieldEdit,
    requestLeave,
    selectCompanyType: (next: CompanyLegalType) => {
      setValue("companyType", next, { shouldDirty: true });
      onFieldEdit();
    },
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
