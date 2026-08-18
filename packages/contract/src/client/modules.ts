/**
 * The client-exposure composition record (contract.md §2, layer 2).
 *
 * `packages/contract` imports **only** module `index.contract.ts` barrels;
 * each module task adds its client-routable descriptors here, keyed
 * `<module>.<verb>` exactly like the descriptor names. No domain modules
 * exist yet, so the record is explicitly empty — keeping the empty
 * statement explicit (rather than defaulting somewhere) means the
 * composition can never skip an exposure decision silently.
 *
 * The server-router builder (./server) proves in both directions that
 * this record matches the boot registry: a registered client action
 * missing here, or an entry here that is not registered, fails boot.
 */
import {
  buildContractRouter,
  type ContractModuleMap,
} from "./contract-router.js";

export const contractModules = {} satisfies ContractModuleMap;

/**
 * The oRPC contract router — what the typed client and the OpenAPI
 * document (fnd-T25) consume.
 */
export const contractRouter = buildContractRouter(contractModules);
