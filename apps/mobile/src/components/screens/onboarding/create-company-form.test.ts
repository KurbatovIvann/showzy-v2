import { describe, expect, it, vi } from "vitest";

import {
  listMineQueryKey,
  type CompanyMembership,
} from "../../../api/company-membership-query";
import { createShowzyQueryClient } from "../../../api/query-client";
import { onboardingCopy } from "../../../i18n/onboarding";
import {
  applyCreatedCompany,
  COMPANY_NAME_MAX,
  createCompanyPayload,
  mapCreateCompanyFailure,
  nextLastSubmitted,
  planCreateCompanySubmit,
  resolveCreateCompanyCopy,
  shouldApplyCreatedCompany,
  validateCreateCompanyForm,
} from "./create-company-form";

const sessionUserId = "33333333-3333-4333-8333-333333333333";

const membership: CompanyMembership = {
  membershipId: "11111111-1111-4111-8111-111111111111",
  role: "owner",
  company: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Солодка майстерня",
    slug: "solodka-maisternia",
    prefix: "SOL",
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

  it("mints a new submit after the user edits, and stays invalid without calling transport", () => {
    expect(
      planCreateCompanySubmit({
        name: "Cafe",
        slug: "cafe-2",
        lastSubmitted: { name: "Cafe", slug: "cafe" },
        lastFailureKind: "network",
      }),
    ).toEqual({ kind: "submit", input: { name: "Cafe", slug: "cafe-2" } });
    expect(
      planCreateCompanySubmit({
        name: "",
        slug: "cafe",
        lastSubmitted: null,
        lastFailureKind: null,
      }).kind,
    ).toBe("invalid");
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
  it("maps wire kinds without reading error messages", () => {
    expect(mapCreateCompanyFailure("conflict")).toEqual({
      slugError: "occupied",
      banner: null,
    });
    expect(mapCreateCompanyFailure("validation")).toEqual({
      slugError: null,
      banner: "validation",
    });
    expect(mapCreateCompanyFailure("unauthenticated")).toEqual({
      slugError: null,
      banner: "unavailable",
    });
    expect(mapCreateCompanyFailure("network")).toEqual({
      slugError: null,
      banner: "network",
    });
    expect(mapCreateCompanyFailure("offline")).toEqual({
      slugError: null,
      banner: "offline",
    });
    expect(mapCreateCompanyFailure("timeout")).toEqual({
      slugError: null,
      banner: "unavailable",
    });
    expect(mapCreateCompanyFailure(null)).toEqual({
      slugError: null,
      banner: null,
    });
  });

  it("does not treat in-flight or idempotency-key collisions as a taken slug", () => {
    expect(mapCreateCompanyFailure("conflict", "RETRY_IN_PROGRESS")).toEqual({
      slugError: null,
      banner: "unavailable",
    });
    expect(mapCreateCompanyFailure("conflict", "IDEMPOTENCY_CONFLICT")).toEqual(
      {
        slugError: null,
        banner: "unavailable",
      },
    );
    expect(
      planCreateCompanySubmit({
        name: "Cafe",
        slug: "cafe",
        lastSubmitted: { name: "Cafe", slug: "cafe" },
        lastFailureKind: "conflict",
        lastWireCode: "RETRY_IN_PROGRESS",
      }),
    ).toEqual({ kind: "retry" });
  });
});

describe("shouldApplyCreatedCompany", () => {
  it("skips selector and navigation after unmount or a dropped client", () => {
    expect(
      shouldApplyCreatedCompany({ mounted: true, clientReady: true }),
    ).toBe(true);
    expect(
      shouldApplyCreatedCompany({ mounted: false, clientReady: true }),
    ).toBe(false);
    expect(
      shouldApplyCreatedCompany({ mounted: true, clientReady: false }),
    ).toBe(false);
  });
});

describe("resolveCreateCompanyCopy", () => {
  const copy = onboardingCopy("en");

  it("never returns empty-string errors and disables submit while pending", () => {
    const idle = resolveCreateCompanyCopy(copy, {
      nameError: null,
      slugError: null,
      banner: null,
      pending: false,
      clientReady: true,
    });
    expect(idle.nameError).toBeNull();
    expect(idle.slugError).toBeNull();
    expect(idle.banner).toBeNull();
    expect(idle.submitDisabled).toBe(false);
    expect(idle.submitLabel).toBe(copy.submit);

    const pending = resolveCreateCompanyCopy(copy, {
      nameError: "required",
      slugError: "occupied",
      banner: "network",
      pending: true,
      clientReady: true,
    });
    expect(pending.nameError).toBe(copy.errors.nameRequired);
    expect(pending.slugError).toBe(copy.errors.slugOccupied);
    expect(pending.banner).toBe(copy.errors.network);
    expect(pending.submitDisabled).toBe(true);
    expect(pending.fieldsEditable).toBe(false);
    expect(pending.submitLabel).toBe(copy.submitLoading);
  });
});

describe("applyCreatedCompany", () => {
  it("selects the returned company, refreshes listMine, and enters the panel once", () => {
    const queryClient = createShowzyQueryClient({ retryDelay: () => 0 });
    const setActiveCompany = vi.fn((companyId: string | null) => {
      void companyId;
    });
    const enterPanel = vi.fn();
    queryClient.setQueryData(listMineQueryKey(sessionUserId), {
      memberships: [],
    });

    applyCreatedCompany({
      membership,
      sessionUserId,
      setActiveCompany,
      queryClient,
      enterPanel,
    });

    expect(setActiveCompany).toHaveBeenCalledTimes(1);
    expect(setActiveCompany).toHaveBeenCalledWith(membership.company.id);
    expect(
      queryClient.getQueryData(listMineQueryKey(sessionUserId)),
    ).toBeUndefined();
    expect(enterPanel).toHaveBeenCalledTimes(1);
  });
});
