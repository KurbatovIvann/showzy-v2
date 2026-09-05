import { describe, expect, it } from "vitest";

import {
  CREATE_COMPANY_NAME_MAX,
  createCompanyContract,
  createCompanyInputSchema,
  createCompanyOutputSchema,
} from "./create.contract.js";

describe("companies.create contract", () => {
  it("is an idempotent audited account client write with no permissions, confirmation, or events", () => {
    expect(createCompanyContract.name).toBe("companies.create");
    expect(createCompanyContract.principal).toBe("account");
    expect(createCompanyContract.transport).toBe("client");
    expect(createCompanyContract.risk).toBe("write");
    expect(createCompanyContract.permissions).toEqual([]);
    expect(createCompanyContract.aiExposure).toBe("exposed");
    expect(createCompanyContract.requiresConfirmation).toBe(false);
    expect(createCompanyContract.idempotent).toBe(true);
    expect(createCompanyContract.audit).toBe(true);
    expect(createCompanyContract.emits).toEqual([]);
    expect(createCompanyContract.atomicCalls).toEqual([]);
    expect(createCompanyContract.atomicCallers).toEqual([]);
    expect(createCompanyContract.timeout).toBe(5_000);
    expect(createCompanyContract.rateLimit).toEqual({
      scope: "user",
      limit: 10,
      windowSec: 300,
    });
  });

  it("accepts a valid name and slug and trims the name", () => {
    const parsed = createCompanyInputSchema.parse({
      name: "  Nova Pekarnya  ",
      slug: "nova-pekarnya",
    });
    expect(parsed).toEqual({ name: "Nova Pekarnya", slug: "nova-pekarnya" });
  });

  it("rejects blank and oversized names", () => {
    const slug = "valid-slug";
    expect(createCompanyInputSchema.safeParse({ name: "", slug }).success).toBe(
      false,
    );
    expect(
      createCompanyInputSchema.safeParse({ name: "   ", slug }).success,
    ).toBe(false);
    expect(
      createCompanyInputSchema.safeParse({
        name: "x".repeat(CREATE_COMPANY_NAME_MAX + 1),
        slug,
      }).success,
    ).toBe(false);
    expect(
      createCompanyInputSchema.safeParse({
        name: "x".repeat(CREATE_COMPANY_NAME_MAX),
        slug,
      }).success,
    ).toBe(true);
  });

  it("rejects slugs outside the canvas format", () => {
    const name = "Valid Name";
    for (const slug of [
      "ab",
      "a".repeat(49),
      "-abc",
      "abc-",
      "ab--cd",
      "Abc",
      "abc_def",
      "abc def",
      "кафе-затишок",
      "café",
    ]) {
      expect(createCompanyInputSchema.safeParse({ name, slug }).success).toBe(
        false,
      );
    }
    for (const slug of ["abc", "a-1", "0-0-0", "a".repeat(48)]) {
      expect(createCompanyInputSchema.safeParse({ name, slug }).success).toBe(
        true,
      );
    }
  });

  it("rejects identifier and authority fields — the input is strict", () => {
    const valid = { name: "Valid Name", slug: "valid-slug" };
    for (const extra of [
      { companyId: "c" },
      { userId: "u" },
      { membershipId: "m" },
      { role: "owner" },
      { permissions: [] },
      { prefix: "XX" },
    ]) {
      expect(
        createCompanyInputSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
    expect(createCompanyInputSchema.safeParse(null).success).toBe(false);
    expect(createCompanyInputSchema.safeParse([]).success).toBe(false);
    expect(createCompanyInputSchema.safeParse({}).success).toBe(false);
  });

  it("returns the owner membership view with an empty permissions array", () => {
    const view = {
      membershipId: "22222222-2222-4222-8222-222222222222",
      role: "owner" as const,
      permissions: [],
      company: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Cafe",
        slug: "cafe",
        prefix: "CA",
      },
    };
    expect(createCompanyOutputSchema.safeParse(view).success).toBe(true);
    expect(
      createCompanyOutputSchema.safeParse({
        membershipId: view.membershipId,
        role: view.role,
        company: view.company,
      }).success,
    ).toBe(false);
  });
});
