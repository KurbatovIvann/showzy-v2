import { describe, expect, it } from "vitest";

import { userFromSession } from "./session-user";

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

  it("treats missing user, empty id, and empty contact fields as anonymous", () => {
    expect(userFromSession(null)).toBeNull();
    expect(userFromSession({ user: { id: "" } })).toBeNull();
    expect(userFromSession({ user: { id: "user-2", email: "" } })).toEqual({
      userId: "user-2",
      email: null,
      phoneNumber: null,
    });
  });
});
