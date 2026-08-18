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
export {
  assertContractCheck,
  ContractCheckError,
  runContractCheck,
} from "./contract-check/contract-check.js";
export type {
  ContractCheckInput,
  ContractCheckResult,
  DeclaredCallEdge,
  EventDefinitionRef,
  EventSubscriptionRef,
  ProjectionGrantLookup,
  ReadModelGrantRef,
  SchemaImportRef,
} from "./contract-check/contract-check.js";
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
  TargetResolutionPrincipal,
  TargetResolver,
} from "./runtime/types.js";
export { executeAction } from "./runtime/pipeline/execute-action.js";
export type { ActionInvocation } from "./runtime/pipeline/execute-action.js";
export type {
  ActionPipelineDeps,
  ActionSpan,
  ActionSpanFields,
  ActionSpanOutcome,
  ActionTelemetry,
  AuditHook,
  ConfirmationHook,
  IdempotencyHook,
  IdempotencyReserveResult,
  PipelineHookEnv,
  PipelineHooks,
  PipelineRequestMeta,
  PreflightAuthorization,
  PrincipalInvocation,
  RateLimitHook,
} from "./runtime/pipeline/types.js";
export {
  createAccountContext,
  createConsumerContext,
  createCustomerContext,
  createPublicContext,
  createStaffContext,
  createSystemContext,
  effectiveCompanyId,
} from "./runtime/context/factories.js";
export type {
  ActionRequestMeta,
  ContextRuntime,
  SessionPrincipal,
  SystemScopeInput,
} from "./runtime/context/factories.js";
export { staffHasPermission } from "./runtime/context/permissions.js";
export type {
  AccountCtx,
  ActionActor,
  ActionChannel,
  ActionCtx,
  BaseCtx,
  CompanyRole,
  ConsumerCtx,
  CtxCall,
  CtxCallAtomic,
  CtxEmit,
  CustomerCtx,
  PublicCtx,
  PublicGlobalCtx,
  PublicTargetCtx,
  StaffCtx,
  StaffMembership,
  SystemCtx,
} from "./runtime/context/types.js";
