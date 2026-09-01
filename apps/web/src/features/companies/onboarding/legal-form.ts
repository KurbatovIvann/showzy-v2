import { contractModules, type WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { OnboardingCopy } from "../../../i18n/companies/onboarding";

/** Caps from `companies.updateLegal` / company-view.contract (SHO-224). */
export const COMPANY_LEGAL_NAME_MAX = 300;
export const COMPANY_LEGAL_EDRPOU_MAX = 10;
export const COMPANY_LEGAL_ADDRESS_MAX = 500;
export const COMPANY_LEGAL_IBAN_MAX = 34;
export const COMPANY_LEGAL_BANK_NAME_MAX = 200;
export const COMPANY_LEGAL_BANK_MFO_MAX = 6;

export type CompanyLegalType = "fop" | "tov";

export type UpdateLegalInput = {
  readonly companyType: CompanyLegalType;
  readonly legalName: string;
  readonly edrpou: string | null;
  readonly legalAddress: string | null;
  readonly iban: string | null;
  readonly bankName: string | null;
  readonly bankMfo: string | null;
  readonly bankEdrpou: string | null;
  readonly phone: string | null;
  readonly email: string | null;
};

export type OnboardingLegalDraft = {
  readonly companyType: CompanyLegalType;
  readonly legalName: string;
  readonly edrpou: string;
  readonly legalAddress: string;
  readonly iban: string;
  readonly bankName: string;
  readonly bankMfo: string;
};

export type LegalNameErrorKey = "required" | "too_long";
export type LengthErrorKey = "too_long";
export type LegalBannerKey = "validation" | "network" | "unavailable";

export type OnboardingLegalFieldErrors = {
  readonly legalName: LegalNameErrorKey | null;
  readonly edrpou: LengthErrorKey | null;
  readonly legalAddress: LengthErrorKey | null;
  readonly iban: LengthErrorKey | null;
  readonly bankName: LengthErrorKey | null;
  readonly bankMfo: LengthErrorKey | null;
};

export type OnboardingLegalSubmitPlan =
  | { readonly kind: "invalid"; readonly errors: OnboardingLegalFieldErrors }
  | { readonly kind: "submit"; readonly input: UpdateLegalInput }
  | { readonly kind: "retry" };

const RETRYABLE_FAILURE: ReadonlySet<QueryFailureKind> = new Set([
  "network",
  "offline",
  "timeout",
  "rate_limited",
  "internal",
]);

const RETRYABLE_WIRE: ReadonlySet<WireErrorCode> = new Set([
  "RETRY_IN_PROGRESS",
  "IDEMPOTENCY_CONFLICT",
]);

export function emptyLegalDraft(): OnboardingLegalDraft {
  return {
    companyType: "fop",
    legalName: "",
    edrpou: "",
    legalAddress: "",
    iban: "",
    bankName: "",
    bankMfo: "",
  };
}

export function emptyLegalErrors(): OnboardingLegalFieldErrors {
  return {
    legalName: null,
    edrpou: null,
    legalAddress: null,
    iban: null,
    bankName: null,
    bankMfo: null,
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function lengthError(value: string, max: number): LengthErrorKey | null {
  return value.trim().length > max ? "too_long" : null;
}

export function validateOnboardingLegal(
  draft: OnboardingLegalDraft,
): OnboardingLegalFieldErrors {
  const trimmedName = draft.legalName.trim();
  const legalName: LegalNameErrorKey | null =
    trimmedName.length === 0
      ? "required"
      : trimmedName.length > COMPANY_LEGAL_NAME_MAX
        ? "too_long"
        : null;
  return {
    legalName,
    edrpou: lengthError(draft.edrpou, COMPANY_LEGAL_EDRPOU_MAX),
    legalAddress: lengthError(draft.legalAddress, COMPANY_LEGAL_ADDRESS_MAX),
    iban: lengthError(draft.iban, COMPANY_LEGAL_IBAN_MAX),
    bankName: lengthError(draft.bankName, COMPANY_LEGAL_BANK_NAME_MAX),
    bankMfo: lengthError(draft.bankMfo, COMPANY_LEGAL_BANK_MFO_MAX),
  };
}

export function isOnboardingLegalValid(
  errors: OnboardingLegalFieldErrors,
): boolean {
  return (
    errors.legalName === null &&
    errors.edrpou === null &&
    errors.legalAddress === null &&
    errors.iban === null &&
    errors.bankName === null &&
    errors.bankMfo === null
  );
}

export function updateLegalPayload(
  draft: OnboardingLegalDraft,
): UpdateLegalInput {
  return {
    companyType: draft.companyType,
    legalName: draft.legalName.trim(),
    edrpou: emptyToNull(draft.edrpou),
    legalAddress: emptyToNull(draft.legalAddress),
    iban: emptyToNull(draft.iban),
    bankName: emptyToNull(draft.bankName),
    bankMfo: emptyToNull(draft.bankMfo),
    bankEdrpou: null,
    phone: null,
    email: null,
  };
}

export function isLegalRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function planOnboardingLegalSubmit(args: {
  readonly draft: OnboardingLegalDraft;
  readonly lastSubmitted: UpdateLegalInput | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): OnboardingLegalSubmitPlan {
  const errors = validateOnboardingLegal(args.draft);
  if (!isOnboardingLegalValid(errors)) {
    return { kind: "invalid", errors };
  }
  const input = updateLegalPayload(args.draft);
  if (
    args.lastSubmitted !== null &&
    JSON.stringify(args.lastSubmitted) === JSON.stringify(input) &&
    isLegalRetryable(args.lastFailureKind, args.lastWireCode ?? null)
  ) {
    return { kind: "retry" };
  }
  return { kind: "submit", input };
}

export function mapLegalFailure(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): LegalBannerKey | null {
  if (kind === null) {
    return null;
  }
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return "unavailable";
  }
  if (kind === "validation") {
    return "validation";
  }
  if (kind === "network") {
    return "network";
  }
  return "unavailable";
}

function legalNameCopy(
  copy: OnboardingCopy,
  key: LegalNameErrorKey | null,
): string | null {
  if (key === "required") {
    return copy.errors.legalNameRequired;
  }
  if (key === "too_long") {
    return copy.errors.legalNameTooLong;
  }
  return null;
}

function lengthCopy(
  copy: OnboardingCopy,
  key: LengthErrorKey | null,
): string | null {
  return key === "too_long" ? copy.errors.tooLong : null;
}

export function resolveLegalCopy(
  copy: OnboardingCopy,
  args: {
    readonly errors: OnboardingLegalFieldErrors;
    readonly banner: LegalBannerKey | null;
    readonly pending: boolean;
  },
): {
  readonly legalNameError: string | null;
  readonly edrpouError: string | null;
  readonly legalAddressError: string | null;
  readonly ibanError: string | null;
  readonly bankNameError: string | null;
  readonly bankMfoError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  return {
    legalNameError: legalNameCopy(copy, args.errors.legalName),
    edrpouError: lengthCopy(copy, args.errors.edrpou),
    legalAddressError: lengthCopy(copy, args.errors.legalAddress),
    ibanError: lengthCopy(copy, args.errors.iban),
    bankNameError: lengthCopy(copy, args.errors.bankName),
    bankMfoError: lengthCopy(copy, args.errors.bankMfo),
    banner: args.banner === null ? null : copy.errors[args.banner],
    submitLabel: args.pending ? copy.legalSubmitLoading : copy.legalSubmit,
    submitDisabled: args.pending,
    fieldsEditable: !args.pending,
  };
}

export function parseUpdateLegalInput(
  input: UpdateLegalInput,
): UpdateLegalInput {
  const parsed = contractModules.companies.updateLegal.input.safeParse(input);
  if (!parsed.success) {
    throw Object.assign(new Error("Validation failed"), {
      code: "VALIDATION" as const,
      status: 400,
      data: {
        issues: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.filter(
            (part): part is string | number =>
              typeof part === "string" || typeof part === "number",
          ),
          message: issue.message,
        })),
      },
    });
  }
  return input;
}
