/**
 * Anthropic `providerOptions` for the staff loop (SHO-337). Thinking is
 * pinned off so a later default (Sonnet 5 adaptive) cannot silently enable
 * billed reasoning. Cache breakpoints land in T6.
 */
export const STAFF_ASSISTANT_THINKING_DISABLED = "disabled" as const;

export const STAFF_ASSISTANT_ANTHROPIC_THINKING = {
  type: STAFF_ASSISTANT_THINKING_DISABLED,
} as const;

export const STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS = {
  thinking: STAFF_ASSISTANT_ANTHROPIC_THINKING,
} as const;
