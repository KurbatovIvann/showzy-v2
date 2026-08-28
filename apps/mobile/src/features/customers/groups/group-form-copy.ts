/**
 * Group form copy keys, formState mapping, and server VALIDATION-by-path
 * mapping (SHO-181). Schema `message` values and issue paths are keys,
 * never user-facing text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type {
  CustomersCountForms,
  CustomersGroupFormCopy,
} from "../../../i18n/customers";
import { interpolate, type Locale } from "../../../i18n/locale";
import { memberCountLabel } from "../shared/member-count";
import type { GroupFormMode } from "./group-form-draft";
import type { GroupFormWrite } from "./group-form-plan";
import {
  isLengthErrorKey,
  isNameErrorKey,
  type GroupFormFieldErrors,
  type LengthErrorKey,
  type NameErrorKey,
} from "./group-form.schema";

export type BannerKey =
  "validation" | "network" | "offline" | "unavailable" | "permission";

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapGroupFormFailure(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): BannerKey | null {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return "unavailable";
  }
  if (kind === null) {
    return null;
  }
  if (kind === "permission") {
    return "permission";
  }
  if (kind === "validation") {
    return "validation";
  }
  if (kind === "network") {
    return "network";
  }
  if (kind === "offline") {
    return "offline";
  }
  return "unavailable";
}

type IssuePath = ReadonlyArray<string | number>;

function issueField(path: IssuePath): "name" | "description" | null {
  const field = path[0];
  if (field === "name") {
    return "name";
  }
  if (field === "description") {
    return "description";
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: GroupFormWrite | null,
): GroupFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let name: NameErrorKey | null = null;
  let description: LengthErrorKey | null = null;
  for (const issue of error.data.issues) {
    const field = issueField(issue.path);
    if (field === "name") {
      name = "required";
    }
    if (field === "description") {
      description = "too_long";
    }
  }
  if (name === null && description === null) {
    return null;
  }
  return { name, description };
}

export type GroupFormRhfErrorEntry = {
  readonly name: "name" | "description";
  readonly message: NameErrorKey | LengthErrorKey;
};

export function rhfPathsForFieldErrors(
  errors: GroupFormFieldErrors,
): readonly GroupFormRhfErrorEntry[] {
  const paths: GroupFormRhfErrorEntry[] = [];
  if (errors.name !== null) {
    paths.push({ name: "name", message: errors.name });
  }
  if (errors.description !== null) {
    paths.push({ name: "description", message: errors.description });
  }
  return paths;
}

export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly descriptionMessage: unknown;
  readonly server: GroupFormFieldErrors | null;
}): GroupFormFieldErrors {
  const name =
    args.submitted &&
    typeof args.nameMessage === "string" &&
    isNameErrorKey(args.nameMessage)
      ? args.nameMessage
      : null;
  const description =
    args.submitted &&
    typeof args.descriptionMessage === "string" &&
    isLengthErrorKey(args.descriptionMessage)
      ? args.descriptionMessage
      : null;
  return {
    name: name ?? args.server?.name ?? null,
    description: description ?? args.server?.description ?? null,
  };
}

function nameErrorCopy(
  copy: CustomersGroupFormCopy,
  key: NameErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.nameRequired;
  }
  if (key === "too_long") {
    return copy.errors.nameTooLong;
  }
  return null;
}

export function groupMemberHint(args: {
  readonly count: number;
  readonly locale: Locale;
  readonly memberHint: string;
  readonly members: CustomersCountForms;
}): string {
  return interpolate(args.memberHint, {
    members: memberCountLabel(args.count, args.locale, args.members),
  });
}

export function resolveGroupFormCopy(
  copy: CustomersGroupFormCopy,
  args: {
    readonly mode: GroupFormMode;
    readonly nameError: NameErrorKey | null;
    readonly descriptionError: LengthErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
  },
): {
  readonly nameError: string | null;
  readonly descriptionError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  const banner = args.banner === null ? null : copy.errors[args.banner];
  return {
    nameError: nameErrorCopy(copy, args.nameError),
    descriptionError:
      args.descriptionError === "too_long"
        ? copy.errors.descriptionTooLong
        : null,
    banner: args.clientReady ? banner : copy.errors.unavailable,
    submitLabel:
      args.mode === "create"
        ? args.pending
          ? copy.submitCreateLoading
          : copy.submitCreate
        : args.pending
          ? copy.submitEditLoading
          : copy.submitEdit,
    submitDisabled: args.pending || !args.clientReady,
    fieldsEditable: !args.pending && args.clientReady,
  };
}
