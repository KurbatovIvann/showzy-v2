/**
 * Seeded server-import leak for the bundle-probe tests (fnd-T25). ESLint
 * ignores this folder — the file exists only so the bundler has a graph
 * that must fail.
 */
import { executeAction } from "@showzy/core";
import { createContractClient } from "@showzy/contract";

export const leak = { createContractClient, executeAction };
