import type { QueryClient } from "@tanstack/react-query";
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import type { OnboardingCopy } from "../../../i18n/companies/onboarding";
import { listMineQueryKey, type CompanyMembership } from "../api/list-mine";

/** Matches `companies.create` name cap (SHO-127). */
export const COMPANY_NAME_MAX = 120;
export const COMPANY_SLUG_MIN = 3;
export const COMPANY_SLUG_MAX = 48;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CreateCompanyInput = {
  readonly name: string;
  readonly slug: string;
};

export type NameErrorKey = "required" | "too_long";
export type SlugErrorKey = "invalid" | "occupied";
export type BannerKey = "validation" | "network" | "unavailable";

export type CreateCompanyFieldErrors = {
  readonly name: NameErrorKey | null;
  readonly slug: SlugErrorKey | null;
};

export type CreateCompanySubmitPlan =
  | { readonly kind: "invalid"; readonly errors: CreateCompanyFieldErrors }
  | { readonly kind: "submit"; readonly input: CreateCompanyInput }
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

export function isCreateCompanyRetryable(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): boolean {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return true;
  }
  return kind !== null && RETRYABLE_FAILURE.has(kind);
}

export function createCompanyPayload(
  name: string,
  slug: string,
): CreateCompanyInput {
  return { name: name.trim(), slug };
}

export function validateCreateCompanyForm(
  name: string,
  slug: string,
): CreateCompanyFieldErrors {
  const trimmed = name.trim();
  const nameError: NameErrorKey | null =
    trimmed.length === 0
      ? "required"
      : trimmed.length > COMPANY_NAME_MAX
        ? "too_long"
        : null;
  const slugError: SlugErrorKey | null =
    SLUG_PATTERN.test(slug) &&
    slug.length >= COMPANY_SLUG_MIN &&
    slug.length <= COMPANY_SLUG_MAX
      ? null
      : "invalid";
  return { name: nameError, slug: slugError };
}

export function isCreateCompanyFormValid(
  errors: CreateCompanyFieldErrors,
): boolean {
  return errors.name === null && errors.slug === null;
}

export function planCreateCompanySubmit(args: {
  readonly name: string;
  readonly slug: string;
  readonly lastSubmitted: CreateCompanyInput | null;
  readonly lastFailureKind: QueryFailureKind | null;
  readonly lastWireCode?: WireErrorCode | null;
}): CreateCompanySubmitPlan {
  const errors = validateCreateCompanyForm(args.name, args.slug);
  if (!isCreateCompanyFormValid(errors)) {
    return { kind: "invalid", errors };
  }
  const input = createCompanyPayload(args.name, args.slug);
  if (
    args.lastSubmitted !== null &&
    args.lastSubmitted.name === input.name &&
    args.lastSubmitted.slug === input.slug &&
    isCreateCompanyRetryable(args.lastFailureKind, args.lastWireCode ?? null)
  ) {
    return { kind: "retry" };
  }
  return { kind: "submit", input };
}

export function nextLastSubmitted(
  plan: CreateCompanySubmitPlan,
  previous: CreateCompanyInput | null,
): CreateCompanyInput | null {
  return plan.kind === "submit" ? plan.input : previous;
}

export function mapCreateCompanyFailure(
  kind: QueryFailureKind | null,
  wireCode: WireErrorCode | null = null,
): {
  readonly slugError: SlugErrorKey | null;
  readonly banner: BannerKey | null;
} {
  if (wireCode !== null && RETRYABLE_WIRE.has(wireCode)) {
    return { slugError: null, banner: "unavailable" };
  }
  if (kind === null) {
    return { slugError: null, banner: null };
  }
  if (kind === "conflict") {
    return { slugError: "occupied", banner: null };
  }
  if (kind === "validation") {
    return { slugError: null, banner: "validation" };
  }
  if (kind === "network") {
    return { slugError: null, banner: "network" };
  }
  return { slugError: null, banner: "unavailable" };
}

function nameErrorCopy(
  copy: OnboardingCopy,
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

function slugErrorCopy(
  copy: OnboardingCopy,
  key: SlugErrorKey | null,
): string | null {
  if (key === "invalid") {
    return copy.errors.slugInvalid;
  }
  if (key === "occupied") {
    return copy.errors.slugOccupied;
  }
  return null;
}

export function resolveCreateCompanyCopy(
  copy: OnboardingCopy,
  args: {
    readonly nameError: NameErrorKey | null;
    readonly slugError: SlugErrorKey | null;
    readonly banner: BannerKey | null;
    readonly pending: boolean;
  },
): {
  readonly nameError: string | null;
  readonly slugError: string | null;
  readonly banner: string | null;
  readonly submitLabel: string;
  readonly submitDisabled: boolean;
  readonly fieldsEditable: boolean;
} {
  return {
    nameError: nameErrorCopy(copy, args.nameError),
    slugError: slugErrorCopy(copy, args.slugError),
    banner: args.banner === null ? null : copy.errors[args.banner],
    submitLabel: args.pending ? copy.createSubmitLoading : copy.createSubmit,
    submitDisabled: args.pending,
    fieldsEditable: !args.pending,
  };
}

/**
 * Select the new company, seed listMine so `/$slug` does not bounce back
 * to onboarding, then invalidate for a server refresh.
 */
export function applyCreatedCompany(args: {
  readonly membership: CompanyMembership;
  readonly setActiveCompany: (companyId: string | null) => void;
  readonly rememberSlug: (slug: string) => void;
  readonly queryClient: QueryClient;
}): void {
  args.setActiveCompany(args.membership.company.id);
  args.rememberSlug(args.membership.company.slug);
  const current = args.queryClient.getQueryData<{
    readonly memberships: readonly CompanyMembership[];
  }>(listMineQueryKey());
  const existing = current?.memberships ?? [];
  const already = existing.some(
    (membership) => membership.company.id === args.membership.company.id,
  );
  args.queryClient.setQueryData(listMineQueryKey(), {
    memberships: already ? existing : [...existing, args.membership],
  });
  void args.queryClient.invalidateQueries({ queryKey: listMineQueryKey() });
}
