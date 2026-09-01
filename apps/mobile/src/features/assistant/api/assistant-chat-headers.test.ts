import { describe, expect, it } from "vitest";
import {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
} from "@showzy/contract";

import { staffAssistantChatHeaders } from "./assistant-chat-headers";

describe("staffAssistantChatHeaders", () => {
  it("sends cookie and x-company-id without a companyId body field", () => {
    expect(
      staffAssistantChatHeaders({
        cookie: "better-auth.session_token=abc",
        companyId: "company-a",
      }),
    ).toEqual({
      cookie: "better-auth.session_token=abc",
      [COMPANY_SELECTOR_HEADER]: "company-a",
    });
  });

  it("adds the confirmation challenge header on resume", () => {
    expect(
      staffAssistantChatHeaders({
        cookie: "better-auth.session_token=abc",
        companyId: "company-a",
        confirmationChallengeId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toEqual({
      cookie: "better-auth.session_token=abc",
      [COMPANY_SELECTOR_HEADER]: "company-a",
      [CONFIRMATION_CHALLENGE_HEADER]: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("omits empty credentials", () => {
    expect(staffAssistantChatHeaders({ cookie: "", companyId: null })).toEqual(
      {},
    );
  });
});
