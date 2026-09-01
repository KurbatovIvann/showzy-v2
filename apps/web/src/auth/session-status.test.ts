import { describe, expect, it } from "vitest";

import { authStatusFromSessionQuery } from "./session-status";

describe("authStatusFromSessionQuery", () => {
  it("stays loading until the first session query settles", () => {
    expect(authStatusFromSessionQuery(true, false, null)).toBe("loading");
    expect(authStatusFromSessionQuery(true, false, "loading")).toBe("loading");
    expect(authStatusFromSessionQuery(false, false, "loading")).toBe(
      "anonymous",
    );
  });

  it("does not return to loading while a settled anonymous session refetches", () => {
    expect(authStatusFromSessionQuery(true, false, "anonymous")).toBe(
      "anonymous",
    );
  });

  it("does not return to loading while a settled authenticated session refetches", () => {
    expect(authStatusFromSessionQuery(true, true, "authenticated")).toBe(
      "authenticated",
    );
  });

  it("applies the settled payload once pending clears", () => {
    expect(authStatusFromSessionQuery(false, true, "anonymous")).toBe(
      "authenticated",
    );
    expect(authStatusFromSessionQuery(false, false, "authenticated")).toBe(
      "anonymous",
    );
  });
});
