import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import { getGroupQueryOptions } from "../api/group-detail-query";
import { customerIdFromParam } from "../shared/customer-id";
import { canEditCustomers } from "../shared/customer-permissions";
import { selectorLookupValue } from "../shared/option-select";
import {
  fieldErrorsFromFormState,
  groupMemberHint,
  mapGroupFormFailure,
  mapValidationIssues,
  resolveGroupFormCopy,
  rhfPathsForFieldErrors,
} from "./group-form-copy";
import {
  cloneGroupFormDraft,
  draftFromGroup,
  emptyGroupFormDraft,
  groupFormFieldChanged,
  snapshotFromGroup,
  type GroupFormDraft,
  type GroupFormMode,
  type GroupFormSnapshot,
} from "./group-form-draft";
import { classifyGroupFormLoad } from "./group-form-load";
import { groupFormResolver } from "./group-form.schema";
import { useGroupFormLookups } from "./use-group-form-lookups";
import { useGroupSave } from "./use-group-save";
import { useUnsavedGroupGuard } from "./use-unsaved-group-guard";

export type GroupFormModel = ReturnType<typeof useGroupForm>;

export function useGroupForm(args: {
  readonly mode: GroupFormMode;
  readonly idParam?: string | string[];
}) {
  const locale = detectLocale();
  const copy = customersCopy(locale);
  const formCopy = copy.groupForm;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const routeGroupId =
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
  } = useForm<GroupFormDraft>({
    defaultValues: emptyGroupFormDraft(),
    resolver: groupFormResolver,
    mode: "onSubmit",
  });
  const { isDirty, errors, isSubmitted } = formState;

  const [origin, setOriginDraft] =
    useState<GroupFormDraft>(emptyGroupFormDraft);
  const [baseline, setBaseline] = useState<GroupFormSnapshot | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const groupIdRef = useRef(routeGroupId);
  if (routeGroupId !== null) {
    groupIdRef.current = routeGroupId;
  }
  const hydratedIdRef = useRef<string | null>(null);

  const query = useQuery(
    getGroupQueryOptions({
      client: canWrite ? apiClient : null,
      companyId: activeCompanyId,
      groupId: routeGroupId,
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
    const next = draftFromGroup(query.data);
    const snap = snapshotFromGroup(query.data);
    reset(next);
    baselineRef.current = snap;
    setOriginDraft(next);
    setBaseline(snap);
  }, [args.mode, query.data, reset]);

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyGroupFormLoad({
    mode: args.mode,
    canWrite,
    groupId: routeGroupId,
    clientReady,
    status: query.status,
    failureKind: query.isError ? describeQueryFailure(query.error).kind : null,
  });

  const lookups = useGroupFormLookups({
    enabled: canWrite && clientReady,
  });

  const priceListId = useWatch({ control, name: "priceListId" }) ?? null;

  const armLeaveRef = useRef(() => {});

  const saveApi = useGroupSave({
    mode: args.mode,
    loadKind: loadState.kind,
    getDraft: () => cloneGroupFormDraft(getValues()),
    setDraft: (next) => {
      reset(next);
    },
    setOrigin: (draft) => {
      reset(draft);
      setOriginDraft(draft);
    },
    groupIdRef,
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

  const { armLeave, requestLeave } = useUnsavedGroupGuard({
    dirty: isDirty,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen: pickerOpen,
    closeSheet: () => {
      setPickerOpen(false);
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
  const fieldErrors = fieldErrorsFromFormState({
    submitted: isSubmitted,
    nameMessage: errors.name?.message,
    descriptionMessage: errors.description?.message,
    server: serverFields,
  });
  const mappedBanner = mapGroupFormFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const pending = saveApi.pending;
  const resolved = resolveGroupFormCopy(formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    descriptionError: fieldErrors.description,
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
      ? copy.editorStub.groupCreateTitle
      : copy.editorStub.groupEditTitle;
  const memberCount = query.data?.memberCount ?? 0;

  return {
    copy,
    mode: args.mode,
    control,
    originName: origin.name,
    originDescription: origin.description,
    state: loadState,
    nameError: resolved.nameError,
    descriptionError: resolved.descriptionError,
    banner: resolved.banner,
    pending,
    submitDisabled:
      resolved.submitDisabled ||
      loadState.kind !== "ready" ||
      (args.mode === "edit" && !isDirty),
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    headerTitle,
    pickerOpen,
    priceListId,
    priceListValue: selectorLookupValue(
      priceListId,
      lookups.priceListNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListChanged: groupFormFieldChanged(
      args.mode,
      priceListId,
      origin.priceListId,
    ),
    priceListOptions: lookups.priceListOptions,
    memberHint:
      args.mode === "edit"
        ? groupMemberHint({
            count: memberCount,
            locale,
            memberHint: formCopy.memberHint,
            members: copy.members,
          })
        : null,
    onFieldEdit,
    requestLeave,
    openPriceListPicker: () => {
      setPickerOpen(true);
    },
    closePicker: () => {
      setPickerOpen(false);
    },
    selectPriceList: (id: string | null) => {
      setValue("priceListId", id, { shouldDirty: true });
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
