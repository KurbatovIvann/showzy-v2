import { describe, expect, it } from "vitest";

import { assistantCopy } from "../../../i18n/assistant";
import {
  assistantChatErrorKind,
  assistantChatErrorMessage,
} from "./chat-error";

describe("assistantChatErrorKind", () => {
  it("maps ASSISTANT_NOT_CONFIGURED from the SSE JSON body", () => {
    const error = new Error(
      JSON.stringify({
        code: "ASSISTANT_NOT_CONFIGURED",
        status: 503,
        message: "not configured",
      }),
    );
    expect(assistantChatErrorKind(error)).toBe("notConfigured");
    expect(
      assistantChatErrorMessage("notConfigured", assistantCopy("en")),
    ).toBe("The assistant is not configured.");
  });

  it("does not treat a non-JSON throw as a cookie leak surface", () => {
    expect(assistantChatErrorKind(new Error("Failed to fetch"))).toBe(
      "unavailable",
    );
  });
});
