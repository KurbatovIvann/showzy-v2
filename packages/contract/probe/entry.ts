/**
 * Minimal client entry for the CI bundle probe (contract.md §2, fnd-T25).
 * Imports the public client surface so a leak anywhere in that graph fails
 * the bundler. Not a production artifact — CI and the probe tests compile it.
 */
import {
  aiToolSourcesForPrincipal,
  contractRouter,
  createContractClient,
  createMutationAttempt,
  isWireError,
  moneyFromWire,
  moneyToWire,
} from "@showzy/contract";

export const probeSurface = {
  aiToolSourcesForPrincipal,
  contractRouter,
  createContractClient,
  createMutationAttempt,
  isWireError,
  moneyFromWire,
  moneyToWire,
};
