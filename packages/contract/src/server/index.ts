/**
 * `@showzy/contract/server` — the server-only half of the contract layer
 * (ADR-0016). `apps/api` imports from here to mount the router; client
 * bundles must import the package root instead — this subpath reaches the
 * core runtime and is rejected by the CI bundle probe (fnd-T25).
 */
export { buildServerRouter } from "./server-router.js";
export type {
  ServerProcedure,
  ServerRouter,
  ServerRouterDeps,
} from "./server-router.js";
export {
  toPipelineRequestMeta,
  toPrincipalInvocation,
} from "./transport-context.js";
export type { TransportInvocationContext } from "./transport-context.js";
export {
  toWireError,
  remapOrpcSchemaError,
  wireErrorInterceptors,
} from "./wire-error.js";
