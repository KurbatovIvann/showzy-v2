/**
 * Typed failure when the staff AI mount is invoked without a configured
 * Anthropic key and without an injected test model. The HTTP process still
 * boots — this is a request-time failure, not a ConfigValidationError.
 */
export class StaffAssistantNotConfiguredError extends Error {
  readonly code = "AI_NOT_CONFIGURED" as const;

  constructor() {
    super("Staff assistant is not configured.");
    this.name = "StaffAssistantNotConfiguredError";
  }
}
