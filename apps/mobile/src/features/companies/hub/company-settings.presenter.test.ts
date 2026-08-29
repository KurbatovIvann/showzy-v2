import { describe, expect, it } from "vitest";

import { canViewCompanySettings } from "../shared/company-permissions";
import {
  classifyCompanyLegalStub,
  classifyCompanySettings,
  companyIdentityView,
  companyLegalRow,
  companySettingsRowAccessibilityLabel,
} from "./company-settings.presenter";

const MISSING = "Ще не додано — потрібні для рахунків";

describe("classifyCompanySettings", () => {
  const base = {
    canView: true,
    clientReady: true,
    status: "success" as const,
    failureKind: null,
  };

  it("is permission when the role cannot view company settings", () => {
    expect(
      classifyCompanySettings({
        ...base,
        canView: false,
        status: "pending",
      }),
    ).toEqual({ kind: "permission" });
  });

  it("is an error when the client is not ready", () => {
    expect(classifyCompanySettings({ ...base, clientReady: false })).toEqual({
      kind: "error",
    });
  });

  it("is loading while the query is pending", () => {
    expect(classifyCompanySettings({ ...base, status: "pending" })).toEqual({
      kind: "loading",
    });
  });

  it("splits offline, permission, and other failures", () => {
    expect(
      classifyCompanySettings({
        ...base,
        status: "error",
        failureKind: "offline",
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyCompanySettings({
        ...base,
        status: "error",
        failureKind: "permission",
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCompanySettings({
        ...base,
        status: "error",
        failureKind: "network",
      }),
    ).toEqual({ kind: "error" });
  });

  it("is ready on a successful fetch", () => {
    expect(classifyCompanySettings(base)).toEqual({ kind: "ready" });
  });
});

describe("classifyCompanyLegalStub", () => {
  it("shows the stub for owner and admin", () => {
    expect(
      classifyCompanyLegalStub({
        canView: canViewCompanySettings("owner"),
      }),
    ).toEqual({ kind: "stub" });
    expect(
      classifyCompanyLegalStub({
        canView: canViewCompanySettings("admin"),
      }),
    ).toEqual({ kind: "stub" });
  });

  it("shows the hub permission empty for manager and employee", () => {
    expect(
      classifyCompanyLegalStub({
        canView: canViewCompanySettings("manager"),
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCompanyLegalStub({
        canView: canViewCompanySettings("employee"),
      }),
    ).toEqual({ kind: "permission" });
  });
});

describe("companySettingsRowAccessibilityLabel", () => {
  it("includes the description so attention vs legal name is not color-only", () => {
    expect(
      companySettingsRowAccessibilityLabel({
        label: "Юридичні реквізити",
        description: "Ще не додано — потрібні для рахунків",
      }),
    ).toBe("Юридичні реквізити. Ще не додано — потрібні для рахунків");
    expect(
      companySettingsRowAccessibilityLabel({
        label: "Юридичні реквізити",
        description: "ФОП Коваль",
      }),
    ).toBe("Юридичні реквізити. ФОП Коваль");
  });
});

describe("companyIdentityView", () => {
  it("renders display-only slug and immutable prefix copy", () => {
    expect(
      companyIdentityView({
        name: "Sophie Patisserie",
        slug: "sophie",
        prefix: "SP",
        slugDisplayTemplate: "shozee.com.ua/{{slug}}",
        prefixExplanationTemplate:
          "Замовлення і рахунки нумеруються як {{prefix}}-1048. Код не змінюється.",
      }),
    ).toEqual({
      name: "Sophie Patisserie",
      slugDisplay: "shozee.com.ua/sophie",
      prefix: "SP",
      prefixExplanation:
        "Замовлення і рахунки нумеруються як SP-1048. Код не змінюється.",
    });
  });
});

describe("companyLegalRow", () => {
  it("uses attention copy when legal is null", () => {
    expect(companyLegalRow({ legal: null, missingLabel: MISSING })).toEqual({
      description: MISSING,
      attention: true,
    });
  });

  it("shows the legal name when legal is present", () => {
    expect(
      companyLegalRow({
        legal: { legalName: "ФОП Коваль" },
        missingLabel: MISSING,
      }),
    ).toEqual({
      description: "ФОП Коваль",
      attention: false,
    });
  });

  it("does not treat a present row with a null name as missing", () => {
    expect(
      companyLegalRow({
        legal: { legalName: null },
        missingLabel: MISSING,
      }),
    ).toEqual({
      description: "",
      attention: false,
    });
  });
});
