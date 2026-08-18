/**
 * Server-callback shapes bound by `implementAction` (core.md §2, ADR-0016).
 *
 * Return types are spec commitments and fully typed. The environment
 * parameters (`ctx`, resolver/summary/audit environments) are deliberately
 * opaque aliases for now: their real shapes are owned by later foundation
 * tasks (principal contexts fnd-T11, pipeline fnd-T12, audit fnd-T13,
 * confirmation fnd-T20). Narrowing an alias later is type-only and cannot
 * break the binding API committed here.
 */
import type { z } from "zod";

export type MaybePromise<T> = T | Promise<T>;

/** JSON-safe value — what redacted audit snapshots must return. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * The execution context passed to handlers. Replaced by the six-mode
 * `ActionCtx` discriminated union (core.md §3) when the principal context
 * factories land (fnd-T11); opaque until then so nothing can depend on
 * context internals prematurely.
 */
export type ActionExecutionCtx = unknown;

/** Narrowed by fnd-T11 to `{ tx, principal, inheritedCompanyId? }` (§2). */
export type TargetResolutionEnv = unknown;

/** Narrowed by fnd-T20 to carry the resolved target alongside input (§7). */
export type ConfirmationSummaryEnv = unknown;

/** Narrowed by fnd-T13 to validated input/output/context accessors (§8). */
export type AuditTargetEnv = unknown;

/**
 * What a typed target resolver must prove (core.md §2): the loaded
 * resource is the ownership/visibility evidence and `companyId` becomes
 * the verified tenant scope of the whole invocation.
 */
export interface ResolvedTarget<TTarget> {
  readonly companyId: string;
  readonly resource: TTarget;
}

/** The audit row's target reference (core.md §8). */
export interface AuditTargetRef {
  readonly type: string;
  readonly id: string;
}

/**
 * Runs inside the pipeline transaction. Receives Zod-validated input and
 * returns a value that the pipeline validates against the output schema
 * before commit (a mismatch is `CoreInvariantError`, core.md §4).
 */
export type ActionHandler<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> = (
  input: z.output<TInput>,
  ctx: ActionExecutionCtx,
) => Promise<z.input<TOutput>>;

/**
 * Loads the referenced resource and proves ownership/visibility; throws
 * `NotFoundError` on any failure — never "forbidden", so existence does
 * not leak (core.md §2).
 */
export type TargetResolver<TInput extends z.ZodType, TTarget> = (
  input: z.output<TInput>,
  env: TargetResolutionEnv,
) => Promise<ResolvedTarget<TTarget>>;

/**
 * Returns the redacted, human-readable summary shown on the confirmation
 * card/dialog (core.md §7). Must not include secrets or non-obvious PII.
 */
export type ConfirmationSummaryFn<TInput extends z.ZodType> = (
  input: z.output<TInput>,
  env: ConfirmationSummaryEnv,
) => MaybePromise<string>;

/** Derives the audit target from validated input/output/context (§8). */
export type AuditTargetFn = (
  env: AuditTargetEnv,
) => MaybePromise<AuditTargetRef>;

/**
 * Opt-in redacted input snapshot for the audit row (core.md §8). Hash-only
 * is the default; returning unredacted input is forbidden (prohibitions:
 * no PII/secrets in logs).
 */
export type AuditSnapshotFn<TInput extends z.ZodType> = (
  input: z.output<TInput>,
) => JsonValue;
