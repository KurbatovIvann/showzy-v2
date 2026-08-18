/**
 * `@showzy/contract` — the client-safe contract layer (contract.md §2).
 *
 * May be imported by client bundles (Expo, later Next.js) and by
 * `apps/api` for composition. Its import graph must never reach the core
 * runtime, `packages/db`, or Node builtins — the CI bundle probe
 * (fnd-T25) enforces this; the server-only half lives at
 * `@showzy/contract/server`.
 */
export {
  aiToolSourcesForPrincipal,
  deriveAiToolSources,
} from "./ai-manifest.js";
export {
  buildContractRouter,
  collectCompositionProblems,
  ContractCompositionError,
  toContractProcedure,
} from "./contract-router.js";
export type {
  ContractModuleMap,
  ContractProcedureFor,
  ContractRouterFor,
} from "./contract-router.js";
export { contractModules, contractRouter } from "./modules.js";
export {
  COMPANY_SELECTOR_HEADER,
  CONFIRMATION_CHALLENGE_HEADER,
  IDEMPOTENCY_KEY_HEADER,
} from "./transport-meta.js";
export {
  wireConfirmationChallengeSchema,
  wireErrorDefinitions,
  wireErrorStatus,
  wireValidationIssueSchema,
} from "./wire-errors.js";
export type { WireErrorCode } from "./wire-errors.js";
