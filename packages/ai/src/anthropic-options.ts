/**
 * Anthropic `providerOptions` for the staff loop (SHO-337). Thinking is
 * pinned off so a later default (Sonnet 5 adaptive) cannot silently enable
 * billed reasoning. Prompt-cache breakpoints mark the stable prefix
 * (system, and the last tool definition when tools are attached).
 */
export const STAFF_ASSISTANT_THINKING_DISABLED = "disabled" as const;

export const STAFF_ASSISTANT_ANTHROPIC_THINKING = {
  type: STAFF_ASSISTANT_THINKING_DISABLED,
} as const;

export const STAFF_ASSISTANT_ANTHROPIC_PROVIDER_OPTIONS = {
  thinking: STAFF_ASSISTANT_ANTHROPIC_THINKING,
} as const;

/** 5-minute ephemeral breakpoint — Anthropic's default TTL for this type. */
export const STAFF_ASSISTANT_CACHE_CONTROL = {
  type: "ephemeral" as const,
  ttl: "5m" as const,
} as const;

export const STAFF_ASSISTANT_CACHE_PROVIDER_OPTIONS = {
  anthropic: {
    cacheControl: STAFF_ASSISTANT_CACHE_CONTROL,
  },
} as const;
