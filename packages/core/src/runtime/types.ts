/**
 * Server-callback shapes bound by `implementAction` (core.md §2, ADR-0016).
 *
 * Return types are spec commitments and fully typed. The remaining opaque
 * environment aliases are owned by later foundation tasks (audit fnd-T13,
 * confirmation fnd-T20); `ActionExecutionCtx` and `TargetResolutionEnv`
 * were narrowed by the principal context factories (fnd-T11). Narrowing an
 * alias is type-only and cannot break the binding API committed here.
 */
import type { ReadTx } from "@showzy/db";
import type { z } from "zod";

import type { ActionCtx } from "./context/types.js";

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
 * The execution context passed to handlers: the six-mode `ActionCtx`
 * discriminated union (core.md §3), constructed only by the principal
 * context factories.
 */
export type ActionExecutionCtx = ActionCtx;

/**
 * Who is asking, from the resolver's point of view (core.md §2): customer
 * resolution receives the authenticated `userId` to prove ownership;
 * public-target resolution is anonymous and proves publication/visibility.
 */
export type TargetResolutionPrincipal =
  | { readonly mode: "customer"; readonly userId: string }
  | { readonly mode: "public" };

/**
 * The environment a typed target resolver runs in (core.md §2): a
 * read-only capability — even when the surrounding transaction is
 * writable — plus the resolving principal. `inheritedCompanyId` is
 * supplied on nested `ctx.call` resolution (core.md §9) and the factory
 * enforces that the resolved company matches it.
 */
export interface TargetResolutionEnv {
  readonly tx: ReadTx;
  readonly principal: TargetResolutionPrincipal;
  readonly inheritedCompanyId?: string;
}

/** Narrowed by fnd-T20 to carry the resolved target alongside input (§7). */
export type ConfirmationSummaryEnv = unknown;

/**
 * The environment `auditTarget` receives (core.md §8, narrowed by fnd-T13).
 * `output` is present on success and absent on failure/denial; `ctx` is
 * present when the execution transaction constructed it (absent on pre-handler
 * denials). Callbacks must tolerate missing fields — `input` is always available.
 */
export interface AuditTargetEnv {
  readonly input: unknown;
  readonly output?: unknown;
  readonly ctx?: ActionCtx;
}

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
