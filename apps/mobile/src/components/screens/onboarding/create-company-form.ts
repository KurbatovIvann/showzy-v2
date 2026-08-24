import type { QueryClient } from "@tanstack/react-query";
import type { WireErrorCode } from "@showzy/contract";

import type { QueryFailureKind } from "../../../api/errors";
import { contractQueryKey } from "../../../api/query-options";
import type { OnboardingCopy } from "../../../i18n/onboarding";

/** Matches `companies.create` name cap (SHO-127). */
export const COMPANY_NAME_MAX = 120;
export const COMPANY_SLUG_MIN = 3;
export const COMPANY_SLUG_MAX = 48;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LIST_MINE_ACTION = "companies.listMine";

export type CreateCompanyInput = {
  readonly name: string;
  readonly slug: string;
};

export type CompanyMembership = {
  readonly membershipId: string;
  readonly role: string;
  readonly company: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly prefix: string;
  };
};

export type ListMineCache = {
  readonly memberships: readonly CompanyMembership[];
};

export type NameErrorKey = "required" | "too_long";
export type SlugErrorKey = "invalid" | "occupied";
export type BannerKey = "validation" | "network" | "offline" | "unavailable";

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

/** Same attempt — not a taken slug. Collapsed into `conflict` by describeQueryFailure. */
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

/** Record the payload at attempt start so a failed submit can retry. */
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
  if (kind === "offline") {
    return { slugError: null, banner: "offline" };
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
    readonly clientReady: boolean;
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
    banner: args.clientReady
      ? args.banner === null
        ? null
        : copy.errors[args.banner]
      : copy.errors.unavailable,
    submitLabel: args.pending ? copy.submitLoading : copy.submit,
    submitDisabled: args.pending || !args.clientReady,
    fieldsEditable: !args.pending && args.clientReady,
  };
}

export function listMineQueryKey() {
  return contractQueryKey(LIST_MINE_ACTION, null, {});
}

export function mergeCreatedMembership(
  current: ListMineCache | undefined,
  created: CompanyMembership,
): ListMineCache {
  if (current === undefined) {
    return { memberships: [created] };
  }
  const rest = current.memberships.filter(
    (row) => row.company.id !== created.company.id,
  );
  return { memberships: [...rest, created] };
}

export function shouldApplyCreatedCompany(args: {
  readonly mounted: boolean;
  readonly clientReady: boolean;
}): boolean {
  return args.mounted && args.clientReady;
}

/**
 * Isolation on `setActiveCompany` clears the query cache first. Seed
 * `companies.listMine` *after* the selector swap so the new row survives.
 */
export function applyCreatedCompany(args: {
  readonly membership: CompanyMembership;
  readonly setActiveCompany: (companyId: string | null) => void;
  readonly queryClient: QueryClient;
  readonly enterPanel: () => void;
}): void {
  args.setActiveCompany(args.membership.company.id);
  args.queryClient.setQueryData(
    listMineQueryKey(),
    (current: ListMineCache | undefined) =>
      mergeCreatedMembership(current, args.membership),
  );
  args.enterPanel();
}
