/**
 * Canonical transport-meta header names (contract.md §3). These travel as
 * headers/oRPC meta — never as action input — so none of them can change
 * the canonical request hash the idempotency protocol computes over the
 * validated input (core.md §5, §7).
 */

/**
 * The staff active-company *selector*. Core verifies it against a
 * `company_members` row — it is never an access grant (ADR-0013), and
 * consumer/account/public dispatch ignores it entirely.
 */
export const COMPANY_SELECTOR_HEADER = "x-company-id";

/**
 * Caller-supplied idempotency key for idempotent mutations. Created once
 * per logical submit and reused for every retry (`createMutationAttempt`);
 * the server rejects a missing key, and never generates one.
 */
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

/**
 * The confirmation challenge reference supplied on re-invocation of a
 * `requiresConfirmation` action (core.md §7). Transport meta by design:
 * carrying it outside the input keeps the input hash stable between the
 * challenged and the confirmed invocation.
 */
export const CONFIRMATION_CHALLENGE_HEADER = "x-confirmation-challenge-id";
