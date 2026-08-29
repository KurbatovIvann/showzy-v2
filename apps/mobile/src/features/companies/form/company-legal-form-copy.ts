/**
 * Company legal form copy keys, formState mapping, and server
 * VALIDATION-by-path mapping (SHO-225). Schema `message` values and
 * issue paths are keys, never user-facing text.
 */
import { isWireError, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { CompaniesLegalFormCopy } from "../../../i18n/companies";
import type { CompanyLegalFormMode } from "./company-legal-form-draft";
import type { CompanyLegalFormWrite } from "./company-legal-form-plan";
import {
  isLengthErrorKey,
  isNameErrorKey,
  type CompanyLegalFormFieldErrors,
  type CompanyLegalLengthField,
  type CompanyTypeErrorKey,
  type LengthErrorKey,
  type NameErrorKey,
} from "./company-legal-form.schema";

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

export function mapCompanyLegalFormFailure(
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
  "bankEdrpou",
  "phone",
  "email",
]);

function issueField(
  path: IssuePath,
): "legalName" | "companyType" | CompanyLegalLengthField | null {
  const field = path[0];
  if (field === "legalName" || field === "companyType") {
    return field;
  }
  if (typeof field === "string" && LENGTH_FIELDS.has(field)) {
    return field as CompanyLegalLengthField;
  }
  return null;
}

/**
 * Map contract `VALIDATION` issues onto fields by path, never by
 * `message` text (contract.md §4).
 */
export function mapValidationIssues(
  error: unknown,
  write: CompanyLegalFormWrite | null,
): CompanyLegalFormFieldErrors | null {
  if (!isWireError(error) || error.code !== "VALIDATION" || write === null) {
    return null;
  }
  let legalName: NameErrorKey | null = null;
  let companyType: CompanyTypeErrorKey | null = null;
  const length: Record<CompanyLegalLengthField, LengthErrorKey | null> = {
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
    bankEdrpou: null,
    phone: null,
    email: null,
  };
  for (const issue of error.data.issues) {
    const field = issueField(issue.path);
    if (field === "legalName") {
      legalName = "required";
      continue;
    }
    if (field === "companyType") {
      companyType = "invalid";
      continue;
    }
    if (field !== null) {
      length[field] = "too_long";
    }
  }
  if (
    legalName === null &&
    companyType === null &&
    length.edrpou === null &&
    length.legalAddress === null &&
    length.iban === null &&
    length.bankName === null &&
    length.bankMfo === null &&
    length.bankEdrpou === null &&
    length.phone === null &&
    length.email === null
  ) {
    return null;
  }
  return { legalName, companyType, ...length };
}

export type CompanyLegalFormRhfErrorEntry = {
  readonly name: "legalName" | "companyType" | CompanyLegalLengthField;
  readonly message: NameErrorKey | LengthErrorKey | CompanyTypeErrorKey;
};

export function rhfPathsForFieldErrors(
  errors: CompanyLegalFormFieldErrors,
): readonly CompanyLegalFormRhfErrorEntry[] {
  const paths: CompanyLegalFormRhfErrorEntry[] = [];
  if (errors.legalName !== null) {
    paths.push({ name: "legalName", message: errors.legalName });
  }
  if (errors.companyType !== null) {
    paths.push({ name: "companyType", message: errors.companyType });
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
  if (errors.bankEdrpou !== null) {
    paths.push({ name: "bankEdrpou", message: errors.bankEdrpou });
  }
  if (errors.phone !== null) {
    paths.push({ name: "phone", message: errors.phone });
  }
  if (errors.email !== null) {
    paths.push({ name: "email", message: errors.email });
  }
  return paths;
}

export function fieldErrorsFromFormState(args: {
  readonly submitted: boolean;
  readonly legalNameMessage: unknown;
  readonly companyTypeMessage: unknown;
  readonly edrpouMessage: unknown;
  readonly legalAddressMessage: unknown;
  readonly ibanMessage: unknown;
  readonly bankNameMessage: unknown;
  readonly bankMfoMessage: unknown;
  readonly bankEdrpouMessage: unknown;
  readonly phoneMessage: unknown;
  readonly emailMessage: unknown;
  readonly server: CompanyLegalFormFieldErrors | null;
}): CompanyLegalFormFieldErrors {
  const legalName =
    args.submitted &&
    typeof args.legalNameMessage === "string" &&
    isNameErrorKey(args.legalNameMessage)
      ? args.legalNameMessage
      : null;
  const companyType =
    args.submitted && typeof args.companyTypeMessage === "string"
      ? "invalid"
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
    legalName: legalName ?? args.server?.legalName ?? null,
    companyType: companyType ?? args.server?.companyType ?? null,
    edrpou: lengthOf(args.edrpouMessage) ?? args.server?.edrpou ?? null,
    legalAddress:
      lengthOf(args.legalAddressMessage) ?? args.server?.legalAddress ?? null,
    iban: lengthOf(args.ibanMessage) ?? args.server?.iban ?? null,
    bankName: lengthOf(args.bankNameMessage) ?? args.server?.bankName ?? null,
    bankMfo: lengthOf(args.bankMfoMessage) ?? args.server?.bankMfo ?? null,
    bankEdrpou:
      lengthOf(args.bankEdrpouMessage) ?? args.server?.bankEdrpou ?? null,
    phone: lengthOf(args.phoneMessage) ?? args.server?.phone ?? null,
    email: lengthOf(args.emailMessage) ?? args.server?.email ?? null,
  };
}

function nameErrorCopy(
  copy: CompaniesLegalFormCopy,
  key: NameErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.legalNameRequired;
  }
  if (key === "too_long") {
    return copy.errors.legalNameTooLong;
  }
  return null;
}

function lengthErrorCopy(
  copy: CompaniesLegalFormCopy,
  field: CompanyLegalLengthField,
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
    case "bankEdrpou":
      return copy.errors.bankEdrpouTooLong;
    case "phone":
      return copy.errors.phoneTooLong;
    case "email":
      return copy.errors.emailTooLong;
  }
}

export function resolveCompanyLegalFormCopy(
  copy: CompaniesLegalFormCopy,
  args: {
    readonly mode: CompanyLegalFormMode;
    readonly legalNameError: NameErrorKey | null;
    readonly companyTypeError: CompanyTypeErrorKey | null;
    readonly edrpouError: LengthErrorKey | null;
    readonly legalAddressError: LengthErrorKey | null;
    readonly ibanError: LengthErrorKey | null;
    readonly bankNameError: LengthErrorKey | null;
    readonly bankMfoError: LengthErrorKey | null;
    readonly bankEdrpouError: LengthErrorKey | null;
    readonly phoneError: LengthErrorKey | null;
    readonly emailError: LengthErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
    readonly clientReady: boolean;
    readonly empty: boolean;
    readonly dirty: boolean;
  },
): {
  readonly legalNameError: string | null;
  readonly edrpouError: string | null;
  readonly legalAddressError: string | null;
  readonly ibanError: string | null;
  readonly bankNameError: string | null;
  readonly bankMfoError: string | null;
  readonly bankEdrpouError: string | null;
  readonly phoneError: string | null;
  readonly emailError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  const bannerKey = args.companyTypeError !== null ? "validation" : args.banner;
  const banner = bannerKey === null ? null : copy.errors[bannerKey];
  return {
    legalNameError: nameErrorCopy(copy, args.legalNameError),
    edrpouError: lengthErrorCopy(copy, "edrpou", args.edrpouError),
    legalAddressError: lengthErrorCopy(
      copy,
      "legalAddress",
      args.legalAddressError,
    ),
    ibanError: lengthErrorCopy(copy, "iban", args.ibanError),
    bankNameError: lengthErrorCopy(copy, "bankName", args.bankNameError),
    bankMfoError: lengthErrorCopy(copy, "bankMfo", args.bankMfoError),
    bankEdrpouError: lengthErrorCopy(copy, "bankEdrpou", args.bankEdrpouError),
    phoneError: lengthErrorCopy(copy, "phone", args.phoneError),
    emailError: lengthErrorCopy(copy, "email", args.emailError),
    banner: args.clientReady ? banner : copy.errors.unavailable,
    submitLabel:
      args.mode === "add"
        ? args.pending
          ? copy.submitAddLoading
          : copy.submitAdd
        : args.pending
          ? copy.submitEditLoading
          : copy.submitEdit,
    submitDisabled:
      args.pending ||
      !args.clientReady ||
      (args.mode === "add" ? args.empty : !args.dirty),
    fieldsEditable: !args.pending && args.clientReady,
  };
}
