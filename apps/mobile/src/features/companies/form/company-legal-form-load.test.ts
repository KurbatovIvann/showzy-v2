import { describe, expect, it } from "vitest";

import type { CompanyLegalView } from "../api/company.queries";
import { canViewCompanySettings } from "../shared/company-permissions";
import {
  snapshotFromCompanyLegal,
  type CompanyLegalFormMode,
  type CompanyLegalFormSnapshot,
} from "./company-legal-form-draft";
import {
  classifyCompanyLegalFormLoad,
  companyLegalFormMode,
  type CompanyLegalFormLoadState,
} from "./company-legal-form-load";

const SAMPLE_UA_IBAN = "UA000000000000000000000000000";

const filledLegal: NonNullable<CompanyLegalView> = {
  id: "11111111-1111-4111-8111-111111111111",
  companyType: "tov",
  legalName: "ТОВ Софі",
  edrpou: "3312456789",
  legalAddress: "м. Київ, вул. Хрещатик, 1",
  iban: SAMPLE_UA_IBAN,
  bankName: "АТ КБ «ПриватБанк»",
  bankMfo: "322313",
  bankEdrpou: "12345678",
  phone: "+380440000000",
  email: "docs@example.com",
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
};

function firstReadyPaint(args: {
  readonly hydrated: boolean;
  readonly legal: CompanyLegalView | undefined;
  readonly baseline: CompanyLegalFormSnapshot | null;
}): {
  readonly kind: CompanyLegalFormLoadState["kind"];
  readonly mode: CompanyLegalFormMode;
} {
  return {
    kind: classifyCompanyLegalFormLoad({
      canView: true,
      clientReady: true,
      status: "success",
      failureKind: null,
      hydrated: args.hydrated,
    }).kind,
    mode: companyLegalFormMode({
      legal: args.legal,
      baseline: args.baseline,
    }),
  };
}

describe("classifyCompanyLegalFormLoad", () => {
  const readyArgs = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
    hydrated: true,
  };

  it("blocks manager and employee before fetching", () => {
    expect(
      classifyCompanyLegalFormLoad({
        ...readyArgs,
        canView: canViewCompanySettings("manager"),
        status: "pending",
        hydrated: false,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCompanyLegalFormLoad({
        ...readyArgs,
        canView: canViewCompanySettings("employee"),
        status: "pending",
        hydrated: false,
      }),
    ).toEqual({ kind: "permission" });
  });

  it("is ready for owner and admin after a successful get", () => {
    expect(
      classifyCompanyLegalFormLoad({
        ...readyArgs,
        canView: canViewCompanySettings("owner"),
      }),
    ).toEqual({ kind: "ready" });
    expect(
      classifyCompanyLegalFormLoad({
        ...readyArgs,
        canView: canViewCompanySettings("admin"),
      }),
    ).toEqual({ kind: "ready" });
  });

  it("is an error when the client is not ready", () => {
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: false,
        status: "pending",
        failureKind: null,
        hydrated: false,
      }),
    ).toEqual({ kind: "error" });
  });

  it("maps query failures onto offline, permission, and error", () => {
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: true,
        status: "error",
        failureKind: "offline",
        hydrated: false,
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: true,
        status: "error",
        failureKind: "permission",
        hydrated: false,
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: true,
        status: "error",
        failureKind: "network",
        hydrated: false,
      }),
    ).toEqual({ kind: "error" });
  });

  it("is loading while the query is pending", () => {
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: true,
        status: "pending",
        failureKind: null,
        hydrated: false,
      }),
    ).toEqual({ kind: "loading" });
  });

  it("stays loading after a successful get until hydrate has applied", () => {
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: true,
        status: "success",
        failureKind: null,
        hydrated: false,
      }),
    ).toEqual({ kind: "loading" });
  });
});

describe("companyLegalFormMode / first ready paint", () => {
  it("is edit from a filled get payload before baseline is set", () => {
    expect(companyLegalFormMode({ legal: filledLegal, baseline: null })).toBe(
      "edit",
    );
  });

  it("is add when legal is null and there is no saved baseline", () => {
    expect(companyLegalFormMode({ legal: null, baseline: null })).toBe("add");
    expect(companyLegalFormMode({ legal: undefined, baseline: null })).toBe(
      "add",
    );
  });

  it("stays edit after an add save before get refetch lands", () => {
    expect(
      companyLegalFormMode({
        legal: null,
        baseline: snapshotFromCompanyLegal(filledLegal),
      }),
    ).toBe("edit");
  });

  it("warm filled get stays loading until hydrate, then first ready paint is edit", () => {
    expect(
      firstReadyPaint({
        hydrated: false,
        legal: filledLegal,
        baseline: null,
      }),
    ).toEqual({ kind: "loading", mode: "edit" });
    expect(
      firstReadyPaint({
        hydrated: true,
        legal: filledLegal,
        baseline: snapshotFromCompanyLegal(filledLegal),
      }),
    ).toEqual({ kind: "ready", mode: "edit" });
  });

  it("warm empty get stays loading until hydrate, then first ready paint is add", () => {
    expect(
      firstReadyPaint({
        hydrated: false,
        legal: null,
        baseline: null,
      }),
    ).toEqual({ kind: "loading", mode: "add" });
    expect(
      firstReadyPaint({
        hydrated: true,
        legal: null,
        baseline: null,
      }),
    ).toEqual({ kind: "ready", mode: "add" });
  });
});
