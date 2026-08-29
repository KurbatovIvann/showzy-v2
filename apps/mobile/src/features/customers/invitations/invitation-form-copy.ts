/**
 * Invitation form copy keys, formState mapping, and server
 * VALIDATION-by-path mapping (SHO-206). Schema `message` values and
 * issue paths are keys, never user-facing text. Contract English
 * (`EXPIRES_AT_RANGE_MESSAGE`, `PERSONAL_MAX_USES_MESSAGE`) is not copy.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { CustomersInviteFormCopy } from "../../../i18n/customers";
import type { InvitationFormWrite } from "./invitation-form-plan";
import {
  isExpiresErrorKey,
  isLengthErrorKey,
  isMaxUsesErrorKey,
  type ExpiresErrorKey,
  type InvitationFormFieldErrors,
  type LengthErrorKey,
  type MaxUsesErrorKey,
} from "./invitation-form.schema";

export type BannerKey =
  "validation" | "network" | "offline" | "unavailable" | "permission";

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapInvitationFormFailure(
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

function issueField(
  path: IssuePath,
): "name" | "phone" | "email" | "expiresAt" | "maxUses" | null {
  const field = path[0];
  if (
    field === "name" ||
    field === "phone" ||
    field === "email" ||
    field === "expiresAt" ||
    field === "maxUses"
  ) {
    return field;
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: InvitationFormWrite | null,
): InvitationFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let name: LengthErrorKey | null = null;
  let phone: LengthErrorKey | null = null;
  let email: LengthErrorKey | null = null;
  let expiresAt: ExpiresErrorKey | null = null;
  let maxUses: MaxUsesErrorKey | null = null;
  for (const issue of error.data.issues) {
    const field = issueField(issue.path);
    if (field === "name") {
      name = "too_long";
    }
    if (field === "phone") {
      phone = "too_long";
    }
    if (field === "email") {
      email = "too_long";
    }
    if (field === "expiresAt") {
      expiresAt = "range";
    }
    if (field === "maxUses") {
      maxUses = "invalid";
    }
  }
  if (
    name === null &&
    phone === null &&
    email === null &&
    expiresAt === null &&
    maxUses === null
  ) {
    return null;
  }
  return { name, phone, email, expiresAt, maxUses };
}

export type InvitationFormRhfErrorEntry = {
  readonly name: "name" | "phone" | "email" | "expiresAt" | "maxUses";
  readonly message: LengthErrorKey | ExpiresErrorKey | MaxUsesErrorKey;
};

export function rhfPathsForFieldErrors(
  errors: InvitationFormFieldErrors,
): readonly InvitationFormRhfErrorEntry[] {
  const paths: InvitationFormRhfErrorEntry[] = [];
  if (errors.name !== null) {
    paths.push({ name: "name", message: errors.name });
  }
  if (errors.phone !== null) {
    paths.push({ name: "phone", message: errors.phone });
  }
  if (errors.email !== null) {
    paths.push({ name: "email", message: errors.email });
  }
  if (errors.expiresAt !== null) {
    paths.push({ name: "expiresAt", message: errors.expiresAt });
  }
  if (errors.maxUses !== null) {
    paths.push({ name: "maxUses", message: errors.maxUses });
  }
  return paths;
}

export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly phoneMessage: unknown;
  readonly emailMessage: unknown;
  readonly expiresAtMessage: unknown;
  readonly maxUsesMessage: unknown;
  readonly server: InvitationFormFieldErrors | null;
}): InvitationFormFieldErrors {
  const name =
    args.submitted &&
    typeof args.nameMessage === "string" &&
    isLengthErrorKey(args.nameMessage)
      ? args.nameMessage
      : null;
  const phone =
    args.submitted &&
    typeof args.phoneMessage === "string" &&
    isLengthErrorKey(args.phoneMessage)
      ? args.phoneMessage
      : null;
  const email =
    args.submitted &&
    typeof args.emailMessage === "string" &&
    isLengthErrorKey(args.emailMessage)
      ? args.emailMessage
      : null;
  const expiresAt =
    args.submitted &&
    typeof args.expiresAtMessage === "string" &&
    isExpiresErrorKey(args.expiresAtMessage)
      ? args.expiresAtMessage
      : null;
  const maxUses =
    args.submitted &&
    typeof args.maxUsesMessage === "string" &&
    isMaxUsesErrorKey(args.maxUsesMessage)
      ? args.maxUsesMessage
      : null;
  return {
    name: name ?? args.server?.name ?? null,
    phone: phone ?? args.server?.phone ?? null,
    email: email ?? args.server?.email ?? null,
    expiresAt: expiresAt ?? args.server?.expiresAt ?? null,
    maxUses: maxUses ?? args.server?.maxUses ?? null,
  };
}

function lengthErrorCopy(
  tooLong: string,
  key: LengthErrorKey | null,
): string | null {
  return key === "too_long" ? tooLong : null;
}

export function resolveInvitationFormCopy(
  copy: CustomersInviteFormCopy,
  args: {
    readonly nameError: LengthErrorKey | null;
    readonly phoneError: LengthErrorKey | null;
    readonly emailError: LengthErrorKey | null;
    readonly expiresAtError: ExpiresErrorKey | null;
    readonly maxUsesError: MaxUsesErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
    readonly created: boolean;
  },
): {
  readonly nameError: string | null;
  readonly phoneError: string | null;
  readonly emailError: string | null;
  readonly expiresAtError: string | null;
  readonly maxUsesError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  const banner = args.banner === null ? null : copy.errors[args.banner];
  const expiresAtError =
    args.expiresAtError === "invalid"
      ? copy.errors.expiresInvalid
      : args.expiresAtError === "range"
        ? copy.errors.expiresRange
        : null;
  return {
    nameError: lengthErrorCopy(copy.errors.nameTooLong, args.nameError),
    phoneError: lengthErrorCopy(copy.errors.phoneTooLong, args.phoneError),
    emailError: lengthErrorCopy(copy.errors.emailTooLong, args.emailError),
    expiresAtError,
    maxUsesError:
      args.maxUsesError === "invalid" ? copy.errors.maxUsesInvalid : null,
    banner: args.clientReady ? banner : copy.errors.unavailable,
    submitLabel: args.pending ? copy.submitCreateLoading : copy.submitCreate,
    submitDisabled: args.pending || !args.clientReady || args.created,
    fieldsEditable: !args.pending && args.clientReady && !args.created,
  };
}
