/**
 * `@showzy/core/testing` — the module test kit (fnd-T21, core.md §12).
 *
 * Every later module inherits tenant isolation by instantiating these
 * suites against its actions. The kit world is the db.md §8 parity
 * fixtures plus matching `companies` / `company_members` rows.
 *
 * `idempotencySuite` / `eventSuite` / `atomicCallSuite` and the contract
 * check that modules instantiate the suites land with fnd-T22.
 */
export { kitIdentities } from "./identities.js";
export type { KitIdentities } from "./identities.js";
export {
  buildTestContext,
  createCapturingLogger,
  createTestKit,
  invokeAction,
  seedTestKit,
} from "./kit.js";
export type {
  BuildTestContextOverrides,
  InvokeOptions,
  IsolationActor,
  TestKit,
} from "./kit.js";
export {
  accountIsolationSuite,
  browseCase,
  consumerIsolationSuite,
  crossTenantSuite,
  isolationCase,
  publicProjectionSuite,
  runAccountIsolationCase,
  runConsumerIsolationCase,
  runCrossTenantCase,
  runPublicProjectionCase,
} from "./suites.js";
export type {
  BrowseCase,
  CrossTenantCase,
  IsolationInvocation,
  SuiteAction,
} from "./suites.js";
