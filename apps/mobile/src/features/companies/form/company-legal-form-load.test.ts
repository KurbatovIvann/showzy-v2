import { describe, expect, it } from "vitest";

import { canViewCompanySettings } from "../shared/company-permissions";
import { classifyCompanyLegalFormLoad } from "./company-legal-form-load";

describe("classifyCompanyLegalFormLoad", () => {
  const readyArgs = {
    clientReady: true,
    status: "success" as const,
    failureKind: null,
  };

  it("blocks manager and employee before fetching", () => {
    expect(
      classifyCompanyLegalFormLoad({
        ...readyArgs,
        canView: canViewCompanySettings("manager"),
        status: "pending",
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCompanyLegalFormLoad({
        ...readyArgs,
        canView: canViewCompanySettings("employee"),
        status: "pending",
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
      }),
    ).toEqual({ kind: "offline" });
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: true,
        status: "error",
        failureKind: "permission",
      }),
    ).toEqual({ kind: "permission" });
    expect(
      classifyCompanyLegalFormLoad({
        canView: true,
        clientReady: true,
        status: "error",
        failureKind: "network",
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
      }),
    ).toEqual({ kind: "loading" });
  });
});
