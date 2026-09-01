import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import * as Clipboard from "expo-clipboard";

import { useApiClient } from "../../../api/api-provider";
import { useActiveCompany } from "../../../api/query-provider";
import { useUnsavedGuard } from "../../../components/form-kit";
import { useResolvedCompany } from "../../../company-resolution/resolved-company-provider";
import { customersCopy } from "../../../i18n/customers";
import { detectLocale } from "../../../i18n/locale";
import { useCustomerFormLookups } from "../form/use-customer-form-lookups";
import { canInviteCustomers } from "../shared/customer-permissions";
import { rhfPathsForFieldErrors } from "./invitation-form-copy";
import {
  applyInviteExpiresDate,
  cloneInvitationFormDraft,
  emptyInvitationFormDraft,
  type InvitationFormDraft,
  type InvitationKind,
} from "./invitation-form-draft";
import { classifyInvitationFormLoad } from "./invitation-form-load";
import type { InviteCreateSecret } from "./invitation-form-plan";
import {
  presentInvitationFormCopy,
  presentInvitationFormView,
  type InvitationCopiedField,
  type InvitationFormPicker,
} from "./invitation-form.presenter";
import { invitationFormResolver } from "./invitation-form.schema";
import { useInvitationSave } from "./use-invitation-save";

export type { InvitationCopiedField, InvitationFormPicker };

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
      // Owner decision 1: stay on the once-only token/url screen.
      // `finish` already invalidates `invites.list`. Do not armLeave —
      // that would tear the secret down. Dirty is false once created.
      return Promise.resolve();
    },
    setFieldErrors: (nextFieldErrors) => {
      for (const entry of rhfPathsForFieldErrors(nextFieldErrors)) {
        setError(entry.name, { type: "validate", message: entry.message });
      }
    },
  });

  const sheetOpen = picker !== null;
  const { requestLeave } = useUnsavedGuard({
    dirty: isDirty && created === null,
    pending: saveApi.pending,
    copy: formCopy,
    sheetOpen,
    closeSheet: () => {
      setPicker(null);
    },
    armedLeave: "dispatch-only",
  });

  const pending = saveApi.pending;
  const resolved = presentInvitationFormCopy({
    formCopy,
    submitted: isSubmitted,
    nameMessage: errors.name?.message,
    phoneMessage: errors.phone?.message,
    emailMessage: errors.email?.message,
    expiresAtMessage: errors.expiresAt?.message,
    maxUsesMessage: errors.maxUses?.message,
    mutationError: saveApi.mutationError,
    lastWrite: saveApi.lastWrite,
    isMutationError: saveApi.isMutationError,
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

  const presented = presentInvitationFormView({
    copy,
    locale,
    loadState,
    resolved,
    pending,
    picker,
    kind,
    groupId,
    priceListId,
    expiresAt,
    lookups,
    created,
    copied,
    copyFailed,
  });

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
    ...presented,
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
