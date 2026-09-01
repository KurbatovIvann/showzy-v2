import { describe, expect, it, vi } from "vitest";

import { createWebQueryClient } from "../../../api/query-client";
import { onboardingCopy } from "../../../i18n/companies/onboarding";
import { listMineQueryKey, type CompanyMembership } from "../api/list-mine";
import {
  applyCreatedCompany,
  COMPANY_NAME_MAX,
  createCompanyPayload,
  mapCreateCompanyFailure,
  nextLastSubmitted,
  planCreateCompanySubmit,
  resolveCreateCompanyCopy,
  validateCreateCompanyForm,
} from "./create-company-form";

const membership: CompanyMembership = {
  membershipId: "11111111-1111-4111-8111-111111111111",
  role: "owner",
  company: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Солодка майстерня",
    slug: "solodka-maisternia",
    prefix: "SO",
  },
};

describe("createCompanyPayload", () => {
  it("sends only trimmed name and slug", () => {
    const payload = createCompanyPayload("  Cafe  ", "cafe");
    expect(payload).toEqual({ name: "Cafe", slug: "cafe" });
    expect(Object.keys(payload)).toEqual(["name", "slug"]);
  });
});

describe("validateCreateCompanyForm", () => {
  it("requires a name and a 3–48 character canvas slug", () => {
    expect(validateCreateCompanyForm("  ", "cafe").name).toBe("required");
    expect(validateCreateCompanyForm("Cafe", "ab").slug).toBe("invalid");
    expect(validateCreateCompanyForm("Cafe", "Cafe").slug).toBe("invalid");
    expect(validateCreateCompanyForm("Cafe", "-cafe").slug).toBe("invalid");
    expect(validateCreateCompanyForm("Cafe", "cafe").name).toBeNull();
    expect(validateCreateCompanyForm("Cafe", "cafe").slug).toBeNull();
  });

  it("caps the name at the server maximum", () => {
    expect(
      validateCreateCompanyForm("x".repeat(COMPANY_NAME_MAX + 1), "cafe").name,
    ).toBe("too_long");
  });

  it("treats panel-route slugs as occupied so they cannot shadow static paths", () => {
    expect(validateCreateCompanyForm("Onboarding", "onboarding").slug).toBe(
      "occupied",
    );
    expect(validateCreateCompanyForm("Sign In", "sign-in").slug).toBe(
      "occupied",
    );
    expect(validateCreateCompanyForm("Verify", "verify").slug).toBe("occupied");
    expect(validateCreateCompanyForm("Cafe", "cafe").slug).toBeNull();
    expect(validateCreateCompanyForm("Onboarding", "Onboarding").slug).toBe(
      "invalid",
    );
    expect(
      planCreateCompanySubmit({
        name: "Onboarding",
        slug: "onboarding",
        lastSubmitted: null,
        lastFailureKind: null,
      }),
    ).toEqual({
      kind: "invalid",
      errors: { name: null, slug: "occupied" },
    });
  });
});

describe("planCreateCompanySubmit", () => {
  it("submits valid input and retries the same attempt after a network failure", () => {
    expect(
      planCreateCompanySubmit({
        name: "Cafe",
        slug: "cafe",
        lastSubmitted: null,
        lastFailureKind: null,
      }),
    ).toEqual({ kind: "submit", input: { name: "Cafe", slug: "cafe" } });
    expect(
      planCreateCompanySubmit({
        name: "Cafe",
        slug: "cafe",
        lastSubmitted: { name: "Cafe", slug: "cafe" },
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });

  it("records the submitted input before the round-trip so a failed attempt can retry", () => {
    const plan = planCreateCompanySubmit({
      name: "Cafe",
      slug: "cafe",
      lastSubmitted: null,
      lastFailureKind: null,
    });
    expect(plan.kind).toBe("submit");
    if (plan.kind !== "submit") {
      return;
    }
    const recorded = nextLastSubmitted(plan, null);
    expect(
      planCreateCompanySubmit({
        name: "Cafe",
        slug: "cafe",
        lastSubmitted: recorded,
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "retry" });
  });
});

describe("mapCreateCompanyFailure", () => {
  it("maps CONFLICT to an occupied slug without reading error messages", () => {
    expect(mapCreateCompanyFailure("conflict")).toEqual({
      slugError: "occupied",
      banner: null,
    });
    expect(mapCreateCompanyFailure("conflict", "RETRY_IN_PROGRESS")).toEqual({
      slugError: null,
      banner: "unavailable",
    });
  });
});

describe("resolveCreateCompanyCopy", () => {
  it("never returns empty-string errors and disables submit while pending", () => {
    const copy = onboardingCopy("uk");
    const pending = resolveCreateCompanyCopy(copy, {
      nameError: "required",
      slugError: "occupied",
      banner: "network",
      pending: true,
    });
    expect(pending.nameError).toBe(copy.errors.nameRequired);
    expect(pending.slugError).toBe(copy.errors.slugOccupied);
    expect(pending.banner).toBe(copy.errors.network);
    expect(pending.submitDisabled).toBe(true);
    expect(pending.submitLabel).toBe(copy.createSubmitLoading);
  });
});

describe("applyCreatedCompany", () => {
  it("selects the returned company and seeds listMine without a second row", () => {
    const queryClient = createWebQueryClient({ retryQueries: false });
    const setActiveCompany = vi.fn((companyId: string | null) => {
      void companyId;
    });
    const rememberSlug = vi.fn((slug: string) => {
      void slug;
    });
    queryClient.setQueryData(listMineQueryKey(), { memberships: [] });

    applyCreatedCompany({
      membership,
      setActiveCompany,
      rememberSlug,
      queryClient,
    });
    applyCreatedCompany({
      membership,
      setActiveCompany,
      rememberSlug,
      queryClient,
    });

    expect(setActiveCompany).toHaveBeenCalledWith(membership.company.id);
    expect(rememberSlug).toHaveBeenCalledWith(membership.company.slug);
    expect(queryClient.getQueryData(listMineQueryKey())).toEqual({
      memberships: [membership],
    });
  });
});
