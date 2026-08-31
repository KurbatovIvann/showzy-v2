import { describe, expect, it } from "vitest";

import { userFromSession, userFromSessionResult } from "./session-user";

describe("userFromSession", () => {
  it("reads id/email/phone and hides the phone-first placeholder email", () => {
    expect(
      userFromSession({
        user: {
          id: "user-1",
          email: "380671112233@phone.invalid",
          phoneNumber: "+380671112233",
        },
      }),
    ).toEqual({
      userId: "user-1",
      email: null,
      phoneNumber: "+380671112233",
    });
  });

  it("unwraps a Better Fetch { data } envelope from getSession", () => {
    expect(
      userFromSessionResult({
        data: { user: { id: "user-2", email: "a@example.com" } },
        error: null,
      }),
    ).toEqual({
      userId: "user-2",
      email: "a@example.com",
      phoneNumber: null,
    });
  });
});
