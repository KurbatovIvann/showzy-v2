import { describe, expect, it } from "vitest";

import { StaffAssistantNotConfiguredError } from "./errors.js";

describe("StaffAssistantNotConfiguredError", () => {
  it("is a typed request-time failure with a stable code", () => {
    const error = new StaffAssistantNotConfiguredError();
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("AI_NOT_CONFIGURED");
    expect(error.message).toBe("Staff assistant is not configured.");
    expect(error.name).toBe("StaffAssistantNotConfiguredError");
  });
});
