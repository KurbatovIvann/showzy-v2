import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import * as Clipboard from "expo-clipboard";

import { useApiClient } from "../../../api/api-provider";
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import { useActiveCompany } from "../../../api/query-provider";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import {
  groupAssignedPriceListId,
  inheritedPriceListPlaceholder,
  selectorLookupValue,
} from "../form/customer-form-pickers";
import { useCustomerFormLookups } from "../form/use-customer-form-lookups";
import { canInviteCustomers } from "../shared/customer-permissions";
import {
  fieldErrorsFromFormState,
  mapInvitationFormFailure,
  mapValidationIssues,
  resolveInvitationFormCopy,
  rhfPathsForFieldErrors,
} from "./invitation-form-copy";
import {
  applyInviteExpiresDate,
  cloneInvitationFormDraft,
  emptyInvitationFormDraft,
  type InvitationFormDraft,
  type InvitationKind,
} from "./invitation-form-draft";
import { classifyInvitationFormLoad } from "./invitation-form-load";
import type { InviteCreateSecret } from "./invitation-form-plan";
import { invitationFormResolver } from "./invitation-form.schema";
import { formatInviteExpiry } from "./invitations-list.presenter";
import { useInvitationSave } from "./use-invitation-save";
import { useUnsavedInvitationGuard } from "./use-unsaved-invitation-guard";

export type InvitationFormPicker = "group" | "priceList" | "expires" | null;

export type InvitationCopiedField = "url" | "token" | null;

export type InvitationFormModel = ReturnType<typeof useInvitationForm>;

export function useInvitationForm() {
  const locale = detectLocale();
  const copy = customersCopy(locale);
  const formCopy = copy.inviteForm;
  const apiClient = useApiClient();
  const { activeCompanyId } = useActiveCompany();
  const membership = useResolvedCompany();
  const canInvite = canInviteCustomers(membership.role);

  const {
    control,
    reset,
    getValues,
    setValue,
    handleSubmit,
    setError,
    clearErrors,
    formState,
  } = useForm<InvitationFormDraft>({
    defaultValues: emptyInvitationFormDraft(),
    resolver: invitationFormResolver,
    mode: "onSubmit",
  });
  const { isDirty, errors, isSubmitted } = formState;

  const [, setOriginDraft] = useState<InvitationFormDraft>(() =>
    emptyInvitationFormDraft(),
  );
  const [picker, setPicker] = useState<InvitationFormPicker>(null);
  const [created, setCreated] = useState<InviteCreateSecret | null>(null);
  const [copied, setCopied] = useState<InvitationCopiedField>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const createdRef = useRef<InviteCreateSecret | null>(null);
  createdRef.current = created;

  const clientReady = apiClient !== null && activeCompanyId !== null;
  const loadState = classifyInvitationFormLoad({
    canInvite,
    clientReady,
  });

  const lookups = useCustomerFormLookups({
    enabled: canInvite && clientReady,
  });

  const watchedKind = useWatch({ control, name: "kind" });
  const kind: InvitationKind =
    watchedKind === "reusable" ? "reusable" : "personal";
  const groupId = useWatch({ control, name: "groupId" }) ?? null;
  const priceListId = useWatch({ control, name: "priceListId" }) ?? null;
  const expiresAt = useWatch({ control, name: "expiresAt" });

  const armLeaveRef = useRef(() => {});

  const saveApi = useInvitationSave({
    loadKind: loadState.kind,
    getDraft: () => cloneInvitationFormDraft(getValues()),
    setOrigin: (draft) => {
      reset(draft);
      setOriginDraft(draft);
    },
    createdRef,
    setCreated,
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

  const sheetOpen = picker !== null;
  const { armLeave, requestLeave } = useUnsavedInvitationGuard({
    dirty: isDirty && created === null,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen,
    closeSheet: () => {
      setPicker(null);
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
    phoneMessage: errors.phone?.message,
    emailMessage: errors.email?.message,
    expiresAtMessage: errors.expiresAt?.message,
    maxUsesMessage: errors.maxUses?.message,
    server: serverFields,
  });
  const mappedBanner = mapInvitationFormFailure(
    failure?.kind ?? null,
    wire?.code ?? null,
  );
  const pending = saveApi.pending;
  const resolved = resolveInvitationFormCopy(formCopy, {
    nameError: fieldErrors.name,
    phoneError: fieldErrors.phone,
    emailError: fieldErrors.email,
    expiresAtError: fieldErrors.expiresAt,
    maxUsesError: fieldErrors.maxUses,
    banner: mappedBanner,
    pending,
    clientReady,
    created: created !== null,
  });

  function onFieldEdit(): void {
    clearErrors();
    saveApi.resetMutation();
    setCopied(null);
    setCopyFailed(false);
  }

  const kindTabs: ReadonlyArray<{
    readonly key: InvitationKind;
    readonly label: string;
  }> = useMemo(
    () => [
      { key: "personal", label: formCopy.kindPersonal },
      { key: "reusable", label: formCopy.kindReusable },
    ],
    [formCopy.kindPersonal, formCopy.kindReusable],
  );

  const groupPriceListId = groupAssignedPriceListId(
    groupId,
    lookups.priceListIdByGroupId,
  );

  async function copyField(
    field: Exclude<InvitationCopiedField, null>,
    value: string | undefined,
  ): Promise<void> {
    if (value === undefined || value.length === 0) {
      return;
    }
    const result = await copyClipboard(value);
    if (result === "ok") {
      setCopied(field);
      setCopyFailed(false);
      return;
    }
    setCopied(null);
    setCopyFailed(true);
  }

  return {
    copy,
    control,
    state: loadState,
    kind,
    kindTabs,
    nameError: resolved.nameError,
    phoneError: resolved.phoneError,
    emailError: resolved.emailError,
    expiresAtError: resolved.expiresAtError,
    maxUsesError: resolved.maxUsesError,
    banner: resolved.banner,
    pending,
    submitDisabled: resolved.submitDisabled || loadState.kind !== "ready",
    submitLabel: resolved.submitLabel,
    fieldsEditable: resolved.fieldsEditable && loadState.kind === "ready",
    headerTitle: copy.editorStub.invitationCreateTitle,
    picker,
    groupId,
    priceListId,
    expiresAt,
    expiresValue: formatInviteExpiry(expiresAt, locale),
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
    groupOptions: lookups.groupOptions,
    priceListOptions: lookups.priceListOptions,
    created,
    copied,
    copyFailed: copyFailed ? formCopy.copyFailed : null,
    onFieldEdit,
    requestLeave,
    selectKind: (next: InvitationKind) => {
      setValue("kind", next, { shouldDirty: true });
      onFieldEdit();
    },
    openGroupPicker: () => {
      setPicker("group");
    },
    openPriceListPicker: () => {
      setPicker("priceList");
    },
    openExpiresPicker: () => {
      setPicker("expires");
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
    selectExpiresDate: (picked: Date) => {
      const next = applyInviteExpiresDate(getValues("expiresAt"), picked);
      setValue("expiresAt", next, { shouldDirty: true });
      onFieldEdit();
    },
    copyUrl: () => {
      void copyField("url", created?.url);
    },
    copyToken: () => {
      void copyField("token", created?.token);
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

async function copyClipboard(value: string): Promise<"ok" | "failed"> {
  try {
    await Clipboard.setStringAsync(value);
    return "ok";
  } catch {
    return "failed";
  }
}
