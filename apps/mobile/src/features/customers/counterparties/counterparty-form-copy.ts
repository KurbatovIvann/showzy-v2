/**
 * Counterparty form copy keys, formState mapping, and server
 * VALIDATION-by-path mapping (SHO-196). Schema `message` values and
 * issue paths are keys, never user-facing text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { CustomersCounterpartyFormCopy } from "../../../i18n/customers";
import type { CounterpartyFormMode } from "./counterparty-form-draft";
import type { CounterpartyFormWrite } from "./counterparty-form-plan";
import {
  isLengthErrorKey,
  isNameErrorKey,
  type CounterpartyFormFieldErrors,
  type CounterpartyLengthField,
  type LengthErrorKey,
  type NameErrorKey,
} from "./counterparty-form.schema";

export type BannerKey =
  | "validation"
  | "conflict"
  | "network"
  | "offline"
  | "unavailable"
  | "permission";

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function mapCounterpartyFormFailure(
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
  if (kind === "conflict") {
    return "conflict";
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

const LENGTH_FIELDS: ReadonlySet<string> = new Set([
  "edrpou",
  "legalAddress",
  "iban",
  "bankName",
  "bankMfo",
  "phone",
  "email",
  "notes",
]);

function issueField(path: IssuePath): "name" | CounterpartyLengthField | null {
  const field = path[0];
  if (field === "name") {
    return "name";
  }
  if (typeof field === "string" && LENGTH_FIELDS.has(field)) {
    return field as CounterpartyLengthField;
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: CounterpartyFormWrite | null,
): CounterpartyFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let name: NameErrorKey | null = null;
  const length: Record<CounterpartyLengthField, LengthErrorKey | null> = {
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
    phone: null,
    email: null,
    notes: null,
  };
  for (const issue of error.data.issues) {
    const field = issueField(issue.path);
    if (field === "name") {
      name = "required";
      continue;
    }
    if (field !== null) {
      length[field] = "too_long";
    }
  }
  if (
    name === null &&
    length.edrpou === null &&
    length.legalAddress === null &&
    length.iban === null &&
    length.bankName === null &&
    length.bankMfo === null &&
    length.phone === null &&
    length.email === null &&
    length.notes === null
  ) {
    return null;
  }
  return { name, ...length };
}

export type CounterpartyFormRhfErrorEntry = {
  readonly name: "name" | CounterpartyLengthField;
  readonly message: NameErrorKey | LengthErrorKey;
};

export function rhfPathsForFieldErrors(
  errors: CounterpartyFormFieldErrors,
): readonly CounterpartyFormRhfErrorEntry[] {
  const paths: CounterpartyFormRhfErrorEntry[] = [];
  if (errors.name !== null) {
    paths.push({ name: "name", message: errors.name });
  }
  if (errors.edrpou !== null) {
    paths.push({ name: "edrpou", message: errors.edrpou });
  }
  if (errors.legalAddress !== null) {
    paths.push({ name: "legalAddress", message: errors.legalAddress });
  }
  if (errors.iban !== null) {
    paths.push({ name: "iban", message: errors.iban });
  }
  if (errors.bankName !== null) {
    paths.push({ name: "bankName", message: errors.bankName });
  }
  if (errors.bankMfo !== null) {
    paths.push({ name: "bankMfo", message: errors.bankMfo });
  }
  if (errors.phone !== null) {
    paths.push({ name: "phone", message: errors.phone });
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
  readonly edrpouMessage: unknown;
  readonly legalAddressMessage: unknown;
  readonly ibanMessage: unknown;
  readonly bankNameMessage: unknown;
  readonly bankMfoMessage: unknown;
  readonly phoneMessage: unknown;
  readonly emailMessage: unknown;
  readonly notesMessage: unknown;
  readonly server: CounterpartyFormFieldErrors | null;
}): CounterpartyFormFieldErrors {
  const name =
    args.submitted &&
    typeof args.nameMessage === "string" &&
    isNameErrorKey(args.nameMessage)
      ? args.nameMessage
      : null;
  function lengthOf(message: unknown): LengthErrorKey | null {
    if (
      args.submitted &&
      typeof message === "string" &&
      isLengthErrorKey(message)
    ) {
      return message;
    }
    return null;
  }
  return {
    name: name ?? args.server?.name ?? null,
    edrpou: lengthOf(args.edrpouMessage) ?? args.server?.edrpou ?? null,
    legalAddress:
      lengthOf(args.legalAddressMessage) ?? args.server?.legalAddress ?? null,
    iban: lengthOf(args.ibanMessage) ?? args.server?.iban ?? null,
    bankName: lengthOf(args.bankNameMessage) ?? args.server?.bankName ?? null,
    bankMfo: lengthOf(args.bankMfoMessage) ?? args.server?.bankMfo ?? null,
    phone: lengthOf(args.phoneMessage) ?? args.server?.phone ?? null,
    email: lengthOf(args.emailMessage) ?? args.server?.email ?? null,
    notes: lengthOf(args.notesMessage) ?? args.server?.notes ?? null,
  };
}

function nameErrorCopy(
  copy: CustomersCounterpartyFormCopy,
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
  copy: CustomersCounterpartyFormCopy,
  field: CounterpartyLengthField,
  key: LengthErrorKey | null,
): string | null {
  if (key !== "too_long") {
    return null;
  }
  switch (field) {
    case "edrpou":
      return copy.errors.edrpouTooLong;
    case "legalAddress":
      return copy.errors.legalAddressTooLong;
    case "iban":
      return copy.errors.ibanTooLong;
    case "bankName":
      return copy.errors.bankNameTooLong;
    case "bankMfo":
      return copy.errors.bankMfoTooLong;
    case "phone":
      return copy.errors.phoneTooLong;
    case "email":
      return copy.errors.emailTooLong;
    case "notes":
      return copy.errors.notesTooLong;
  }
}

export function resolveCounterpartyFormCopy(
  copy: CustomersCounterpartyFormCopy,
  args: {
    readonly mode: CounterpartyFormMode;
    readonly nameError: NameErrorKey | null;
    readonly edrpouError: LengthErrorKey | null;
    readonly legalAddressError: LengthErrorKey | null;
    readonly ibanError: LengthErrorKey | null;
    readonly bankNameError: LengthErrorKey | null;
    readonly bankMfoError: LengthErrorKey | null;
    readonly phoneError: LengthErrorKey | null;
    readonly emailError: LengthErrorKey | null;
    readonly notesError: LengthErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
  },
): {
  readonly nameError: string | null;
  readonly edrpouError: string | null;
  readonly legalAddressError: string | null;
  readonly ibanError: string | null;
  readonly bankNameError: string | null;
  readonly bankMfoError: string | null;
  readonly phoneError: string | null;
  readonly emailError: string | null;
  readonly notesError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  const banner = args.banner === null ? null : copy.errors[args.banner];
  return {
    nameError: nameErrorCopy(copy, args.nameError),
    edrpouError: lengthErrorCopy(copy, "edrpou", args.edrpouError),
    legalAddressError: lengthErrorCopy(
      copy,
      "legalAddress",
      args.legalAddressError,
    ),
    ibanError: lengthErrorCopy(copy, "iban", args.ibanError),
    bankNameError: lengthErrorCopy(copy, "bankName", args.bankNameError),
    bankMfoError: lengthErrorCopy(copy, "bankMfo", args.bankMfoError),
    phoneError: lengthErrorCopy(copy, "phone", args.phoneError),
    emailError: lengthErrorCopy(copy, "email", args.emailError),
    notesError: lengthErrorCopy(copy, "notes", args.notesError),
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
