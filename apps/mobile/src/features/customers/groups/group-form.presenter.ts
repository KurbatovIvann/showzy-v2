/**
 * Group-form view-model assembly (SHO-307). Composer glue stays in
 * `use-group-form.ts`.
 */
import { describeQueryFailure, describeWireError } from "../../../api/errors";
import type { CustomersCopy } from "../../../i18n/customers";
import type { Locale } from "../../../i18n/locale";
import type { OptionSelectItem } from "../shared/option-select";
import { selectorLookupValue } from "../shared/option-select";
import {
  fieldErrorsFromFormState,
  groupMemberHint,
  mapGroupFormFailure,
  mapValidationIssues,
  resolveGroupFormCopy,
} from "./group-form-copy";
import {
  groupFormFieldChanged,
  type GroupFormDraft,
  type GroupFormMode,
} from "./group-form-draft";
import type { GroupFormLoadState } from "./group-form-load";
import type { GroupFormWrite } from "./group-form-plan";

export function presentGroupFormCopy(args: {
  readonly formCopy: CustomersCopy["groupForm"];
  readonly mode: GroupFormMode;
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly descriptionMessage: unknown;
  readonly mutationError: unknown;
  readonly lastWrite: GroupFormWrite | null;
  readonly isMutationError: boolean;
  readonly pending: boolean;
  readonly clientReady: boolean;
}): ReturnType<typeof resolveGroupFormCopy> {
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
    descriptionMessage: args.descriptionMessage,
    server: serverFields,
  });
  return resolveGroupFormCopy(args.formCopy, {
    mode: args.mode,
    nameError: fieldErrors.name,
    descriptionError: fieldErrors.description,
    banner: mapGroupFormFailure(failure?.kind ?? null, wire?.code ?? null),
    pending: args.pending,
    clientReady: args.clientReady,
  });
}

export function presentGroupFormView(args: {
  readonly copy: CustomersCopy;
  readonly locale: Locale;
  readonly mode: GroupFormMode;
  readonly origin: GroupFormDraft;
  readonly loadState: GroupFormLoadState;
  readonly resolved: ReturnType<typeof resolveGroupFormCopy>;
  readonly pending: boolean;
  readonly isDirty: boolean;
  readonly pickerOpen: boolean;
  readonly priceListId: string | null;
  readonly lookups: {
    readonly priceListNameById: ReadonlyMap<string, string>;
    readonly priceListOptions: readonly OptionSelectItem[];
  };
  readonly memberCount: number;
}): {
  readonly originName: string;
  readonly originDescription: string;
  readonly state: GroupFormLoadState;
  readonly nameError: string | null;
  readonly descriptionError: string | null;
  readonly banner: string | null;
  readonly pending: boolean;
  readonly submitDisabled: boolean;
  readonly submitLabel: string;
  readonly fieldsEditable: boolean;
  readonly headerTitle: string;
  readonly pickerOpen: boolean;
  readonly priceListId: string | null;
  readonly priceListValue: string | undefined;
  readonly priceListChanged: boolean;
  readonly priceListOptions: readonly OptionSelectItem[];
  readonly memberHint: string | null;
} {
  const formCopy = args.copy.groupForm;
  return {
    originName: args.origin.name,
    originDescription: args.origin.description,
    state: args.loadState,
    nameError: args.resolved.nameError,
    descriptionError: args.resolved.descriptionError,
    banner: args.resolved.banner,
    pending: args.pending,
    submitDisabled:
      args.resolved.submitDisabled ||
      args.loadState.kind !== "ready" ||
      (args.mode === "edit" && !args.isDirty),
    submitLabel: args.resolved.submitLabel,
    fieldsEditable:
      args.resolved.fieldsEditable && args.loadState.kind === "ready",
    headerTitle:
      args.mode === "create"
        ? args.copy.editorStub.groupCreateTitle
        : args.copy.editorStub.groupEditTitle,
    pickerOpen: args.pickerOpen,
    priceListId: args.priceListId,
    priceListValue: selectorLookupValue(
      args.priceListId,
      args.lookups.priceListNameById,
      formCopy.assignmentUnavailable,
    ),
    priceListChanged: groupFormFieldChanged(
      args.mode,
      args.priceListId,
      args.origin.priceListId,
    ),
    priceListOptions: args.lookups.priceListOptions,
    memberHint:
      args.mode === "edit"
        ? groupMemberHint({
            count: args.memberCount,
            locale: args.locale,
            memberHint: formCopy.memberHint,
            members: args.copy.members,
          })
        : null,
  };
}
