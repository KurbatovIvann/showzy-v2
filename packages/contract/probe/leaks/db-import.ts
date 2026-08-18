/**
 * Seeded @showzy/db leak for the bundle-probe tests (fnd-T25).
 */
import { createDbClient } from "@showzy/db";
import { createContractClient } from "@showzy/contract";

export const leak = { createContractClient, createDbClient };
