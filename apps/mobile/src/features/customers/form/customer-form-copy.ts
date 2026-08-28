/**
 * Customer form copy keys, formState mapping, and server VALIDATION-by-path
 * mapping (SHO-180). Schema `message` values and issue paths are keys,
 * never user-facing text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { CustomersFormCopy } from "../../../i18n/customers";
import type { CustomerFormMode } from "./customer-form-draft";
import type { CustomerFormWrite } from "./customer-form-plan";
import {
  isContactErrorKey,
  isLengthErrorKey,
  isNameErrorKey,
  type ContactErrorKey,
  type CustomerFormFieldErrors,
  type LengthErrorKey,
  type NameErrorKey,
} from "./customer-form.schema";

export type BannerKey =
  "validation" | "network" | "offline" | "unavailable" | "permission";

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapCustomerFormFailure(
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
): "name" | "phone" | "email" | "notes" | "contact" | null {
  const field = path[0];
  if (field === "name") {
    return "name";
  }
  if (field === "phone") {
    return "phone";
  }
  if (field === "email") {
    return "email";
  }
  if (field === "notes") {
    return "notes";
  }
  if (field === "userId" || field === "groupId" || field === "priceListId") {
    return "contact";
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: CustomerFormWrite | null,
): CustomerFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let name: NameErrorKey | null = null;
  let phone: LengthErrorKey | null = null;
  let email: LengthErrorKey | null = null;
  let notes: LengthErrorKey | null = null;
  let contact: ContactErrorKey | null = null;
  for (const issue of error.data.issues) {
    const field = issueField(issue.path);
    if (field === "name") {
      name = "required";
    }
    if (field === "phone") {
      phone = "too_long";
    }
    if (field === "email") {
      email = "too_long";
    }
    if (field === "notes") {
      notes = "too_long";
    }
    if (field === "contact") {
      contact = "required";
    }
  }
  if (
    name === null &&
    phone === null &&
    email === null &&
    notes === null &&
    contact === null
  ) {
    return null;
  }
  return { name, phone, email, notes, contact };
}

export type CustomerFormRhfErrorEntry = {
  readonly name: "name" | "phone" | "email" | "notes";
  readonly message: NameErrorKey | LengthErrorKey | "contact";
};

/**
 * Planner `invalid` field errors → RHF `setError` names. Contact refine
 * lands on `phone` with message `contact` (not a parallel store).
 */
export function rhfPathsForFieldErrors(
  errors: CustomerFormFieldErrors,
): readonly CustomerFormRhfErrorEntry[] {
  const paths: CustomerFormRhfErrorEntry[] = [];
  if (errors.name !== null) {
    paths.push({ name: "name", message: errors.name });
  }
  if (errors.phone !== null) {
    paths.push({ name: "phone", message: errors.phone });
  }
  if (errors.contact !== null) {
    paths.push({ name: "phone", message: "contact" });
  }
  if (errors.email !== null) {
    paths.push({ name: "email", message: errors.email });
  }
  if (errors.notes !== null) {
    paths.push({ name: "notes", message: errors.notes });
  }
  return paths;
}

export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly nameMessage: unknown;
  readonly phoneMessage: unknown;
  readonly emailMessage: unknown;
  readonly notesMessage: unknown;
  readonly server: CustomerFormFieldErrors | null;
}): CustomerFormFieldErrors {
  const name =
    args.submitted &&
    typeof args.nameMessage === "string" &&
    isNameErrorKey(args.nameMessage)
      ? args.nameMessage
      : null;
  const phoneMessage =
    args.submitted && typeof args.phoneMessage === "string"
      ? args.phoneMessage
      : null;
  const phone =
    phoneMessage !== null && isLengthErrorKey(phoneMessage)
      ? phoneMessage
      : null;
  const contactFromRhf =
    phoneMessage !== null && phoneMessage === "contact" ? "required" : null;
  const email =
    args.submitted &&
    typeof args.emailMessage === "string" &&
    isLengthErrorKey(args.emailMessage)
      ? args.emailMessage
      : null;
  const notes =
    args.submitted &&
    typeof args.notesMessage === "string" &&
    isLengthErrorKey(args.notesMessage)
      ? args.notesMessage
      : null;
  return {
    name: name ?? args.server?.name ?? null,
    phone: phone ?? args.server?.phone ?? null,
    email: email ?? args.server?.email ?? null,
    notes: notes ?? args.server?.notes ?? null,
    contact: contactFromRhf ?? args.server?.contact ?? null,
  };
}

function nameErrorCopy(
  copy: CustomersFormCopy,
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

function lengthErrorCopy(
  copy: CustomersFormCopy,
  field: "phone" | "email" | "notes",
  key: LengthErrorKey | null,
): string | null {
  if (key !== "too_long") {
    return null;
  }
  if (field === "phone") {
    return copy.errors.phoneTooLong;
  }
  if (field === "email") {
    return copy.errors.emailTooLong;
  }
  return copy.errors.notesTooLong;
}

export function resolveCustomerFormCopy(
  copy: CustomersFormCopy,
  args: {
    readonly mode: CustomerFormMode;
    readonly nameError: NameErrorKey | null;
    readonly phoneError: LengthErrorKey | null;
    readonly emailError: LengthErrorKey | null;
    readonly notesError: LengthErrorKey | null;
    readonly contactError: ContactErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
  },
): {
  readonly nameError: string | null;
  readonly phoneError: string | null;
  readonly emailError: string | null;
  readonly notesError: string | null;
  readonly contactError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  const banner = args.banner === null ? null : copy.errors[args.banner];
  return {
    nameError: nameErrorCopy(copy, args.nameError),
    phoneError: lengthErrorCopy(copy, "phone", args.phoneError),
    emailError: lengthErrorCopy(copy, "email", args.emailError),
    notesError: lengthErrorCopy(copy, "notes", args.notesError),
    contactError:
      args.contactError !== null && isContactErrorKey(args.contactError)
        ? copy.errors.contactRequired
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
