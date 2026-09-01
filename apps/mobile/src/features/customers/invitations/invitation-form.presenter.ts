/**
 * Invitation-form view-model assembly (SHO-307). Composer glue stays in
 * `use-invitation-form.ts`. Token/url stay in hook state; this file
 * never logs them.
 */
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import type { CustomersCopy } from "../../../i18n/customers";
import type { Locale } from "../../../i18n/locale";
import {
  groupAssignedPriceListId,
  inheritedPriceListPlaceholder,
} from "../form/customer-form-pickers";
import type { OptionSelectItem } from "../shared/option-select";
import { selectorLookupValue } from "../shared/option-select";
import {
  fieldErrorsFromFormState,
  mapInvitationFormFailure,
  mapValidationIssues,
  resolveInvitationFormCopy,
} from "./invitation-form-copy";
import type { InvitationKind } from "./invitation-form-draft";
import type { InvitationFormLoadState } from "./invitation-form-load";
import type {
  InvitationFormWrite,
  InviteCreateSecret,
} from "./invitation-form-plan";
import { formatInviteExpiry } from "./invitations-list.presenter";

export type InvitationFormPicker = "group" | "priceList" | "expires" | null;

export type InvitationCopiedField = "url" | "token" | null;

export function presentInvitationFormCopy(args: {
  readonly formCopy: CustomersCopy["inviteForm"];
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly phoneMessage: unknown;
  readonly emailMessage: unknown;
  readonly expiresAtMessage: unknown;
  readonly maxUsesMessage: unknown;
  readonly mutationError: unknown;
  readonly lastWrite: InvitationFormWrite | null;
  readonly isMutationError: boolean;
  readonly pending: boolean;
  readonly clientReady: boolean;
  readonly created: boolean;
}): ReturnType<typeof resolveInvitationFormCopy> {
  const failure = args.isMutationError
    ? describeQueryFailure(args.mutationError)
    : null;
  const wire = args.isMutationError
    ? describeWireError(args.mutationError)
    : null;
  const serverFields = args.isMutationError
    ? mapValidationIssues(args.mutationError, args.lastWrite)
    : null;
  const fieldErrors = fieldErrorsFromFormState({
    submitted: args.submitted,
    nameMessage: args.nameMessage,
    phoneMessage: args.phoneMessage,
    emailMessage: args.emailMessage,
    expiresAtMessage: args.expiresAtMessage,
    maxUsesMessage: args.maxUsesMessage,
    server: serverFields,
  });
  return resolveInvitationFormCopy(args.formCopy, {
    nameError: fieldErrors.name,
    phoneError: fieldErrors.phone,
    emailError: fieldErrors.email,
    expiresAtError: fieldErrors.expiresAt,
    maxUsesError: fieldErrors.maxUses,
    banner: mapInvitationFormFailure(failure?.kind ?? null, wire?.code ?? null),
    pending: args.pending,
    clientReady: args.clientReady,
    created: args.created,
  });
}

export function presentInvitationKindTabs(
  formCopy: CustomersCopy["inviteForm"],
): ReadonlyArray<{ readonly key: InvitationKind; readonly label: string }> {
  return [
    { key: "personal", label: formCopy.kindPersonal },
    { key: "reusable", label: formCopy.kindReusable },
  ];
}

export function presentInvitationFormView(args: {
  readonly copy: CustomersCopy;
  readonly locale: Locale;
  readonly loadState: InvitationFormLoadState;
  readonly resolved: ReturnType<typeof resolveInvitationFormCopy>;
  readonly pending: boolean;
  readonly picker: InvitationFormPicker;
  readonly kind: InvitationKind;
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly expiresAt: string;
  readonly lookups: {
    readonly groupNameById: ReadonlyMap<string, string>;
    readonly priceListNameById: ReadonlyMap<string, string>;
    readonly priceListIdByGroupId: ReadonlyMap<string, string | null>;
    readonly groupOptions: readonly OptionSelectItem[];
    readonly priceListOptions: readonly OptionSelectItem[];
  };
  readonly created: InviteCreateSecret | null;
  readonly copied: InvitationCopiedField;
  readonly copyFailed: boolean;
}): {
  readonly state: InvitationFormLoadState;
  readonly kind: InvitationKind;
  readonly kindTabs: ReadonlyArray<{
    readonly key: InvitationKind;
    readonly label: string;
  }>;
  readonly nameError: string | null;
  readonly phoneError: string | null;
  readonly emailError: string | null;
  readonly expiresAtError: string | null;
  readonly maxUsesError: string | null;
  readonly banner: string | null;
  readonly pending: boolean;
  readonly submitDisabled: boolean;
  readonly submitLabel: string;
  readonly fieldsEditable: boolean;
  readonly headerTitle: string;
  readonly picker: InvitationFormPicker;
  readonly groupId: string | null;
  readonly priceListId: string | null;
  readonly expiresAt: string;
  readonly expiresValue: string;
  readonly groupValue: string | undefined;
  readonly priceListValue: string | undefined;
  readonly priceListPlaceholder: string;
  readonly groupOptions: readonly OptionSelectItem[];
  readonly priceListOptions: readonly OptionSelectItem[];
  readonly created: InviteCreateSecret | null;
  readonly copied: InvitationCopiedField;
  readonly copyFailed: string | null;
} {
  const formCopy = args.copy.inviteForm;
  const groupPriceListId = groupAssignedPriceListId(
    args.groupId,
    args.lookups.priceListIdByGroupId,
  );
  return {
    state: args.loadState,
    kind: args.kind,
    kindTabs: presentInvitationKindTabs(formCopy),
    nameError: args.resolved.nameError,
    phoneError: args.resolved.phoneError,
    emailError: args.resolved.emailError,
    expiresAtError: args.resolved.expiresAtError,
    maxUsesError: args.resolved.maxUsesError,
    banner: args.resolved.banner,
    pending: args.pending,
    submitDisabled:
      args.resolved.submitDisabled || args.loadState.kind !== "ready",
    submitLabel: args.resolved.submitLabel,
    fieldsEditable:
      args.resolved.fieldsEditable && args.loadState.kind === "ready",
    headerTitle: args.copy.editorStub.invitationCreateTitle,
    picker: args.picker,
    groupId: args.groupId,
    priceListId: args.priceListId,
    expiresAt: args.expiresAt,
    expiresValue: formatInviteExpiry(args.expiresAt, args.locale),
    groupValue: selectorLookupValue(
      args.groupId,
      args.lookups.groupNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListValue: selectorLookupValue(
      args.priceListId,
      args.lookups.priceListNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListPlaceholder: inheritedPriceListPlaceholder({
      groupPriceListId,
      inheritGroup: formCopy.priceListInheritGroup,
      retailDefault: formCopy.priceListDefault,
    }),
    groupOptions: args.lookups.groupOptions,
    priceListOptions: args.lookups.priceListOptions,
    created: args.created,
    copied: args.copied,
    copyFailed: args.copyFailed ? formCopy.copyFailed : null,
  };
}
