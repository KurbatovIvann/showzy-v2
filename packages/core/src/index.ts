/**
 * `@showzy/core` — the server-side action runtime (ADR-0016).
 *
 * Server-only: module `actions/<name>.ts` implementations and app boot
 * code import from here. Client bundles and `*.contract.ts` files must
 * import `@showzy/core/contract` instead; domain code throws from
 * `@showzy/core/errors`.
 */
export {
  ActionImplementationError,
  implementAction,
} from "./runtime/implement-action.js";
export type {
  ActionServerCallbacks,
  ImplementedAction,
} from "./runtime/implement-action.js";
export {
  ActionRegistry,
  ActionRegistryError,
} from "./runtime/action-registry.js";
export type {
  AnyActionContract,
  RegisteredImplementation,
} from "./runtime/action-registry.js";
export type {
  ActionExecutionCtx,
  ActionHandler,
  AuditSnapshotFn,
  AuditTargetEnv,
  AuditTargetFn,
  AuditTargetRef,
  ConfirmationSummaryEnv,
  ConfirmationSummaryFn,
  JsonValue,
  MaybePromise,
  ResolvedTarget,
  TargetResolutionEnv,
  TargetResolver,
} from "./runtime/types.js";
