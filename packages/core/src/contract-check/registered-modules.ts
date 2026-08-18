/**
 * The composition manifest the CI contract-check stage walks (fnd-T10).
 *
 * This is the interim composition root: no domain modules exist yet, so
 * every manifest is explicitly empty. Each foundation/module task that adds
 * a registerable surface extends this file:
 *
 * - module barrels (`index.ts` / `index.contract.ts`) register their
 *   actions here until `packages/contract` (fnd-T23) and the apps/api boot
 *   (fnd-T26) become the real composition roots — at that point the stage
 *   walks those instead and this file is retired;
 * - event definitions (`defineEvent`, fnd-T16) and subscriptions
 *   (`eventSubscriptionRefs`, fnd-T17) are registered by the modules that
 *   declare them — first with the reference slices;
 * - projection owners (`search`, `analytics`) wire the runtime
 *   `projectionGrants` manifest from `@showzy/db` in their schema tasks —
 *   until core gains that dependency (fnd-T11/T12 need it for transaction
 *   facades), the empty set here states that no grant exists;
 * - the schema-ownership entries (read-model grants and foreign schema
 *   imports) are declared by the owning specs' tasks;
 * - inherited-suite coverage (`suiteCoverage`) is declared by each
 *   module that registers actions — empty until the first module lands.
 *
 * Keeping the empty statements explicit (rather than defaulting inside the
 * check) means a composition root can never skip a rule class silently.
 */
import { ActionRegistry } from "../runtime/action-registry.js";
import type { ContractCheckInput } from "./contract-check.js";
import { emptySuiteCoverage } from "./suite-coverage.js";

export function buildContractCheckStageInput(): ContractCheckInput {
  const registry = new ActionRegistry();
  return {
    registry,
    events: [],
    subscriptions: [],
    callEdges: [],
    projectionGrants: new Set<string>(),
    readModelGrants: [],
    schemaImports: [],
    suiteCoverage: emptySuiteCoverage,
  };
}
