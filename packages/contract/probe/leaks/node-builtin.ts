/**
 * Seeded Node-builtin leak for the bundle-probe tests (fnd-T25).
 */
import { readFileSync } from "node:fs";
import { createContractClient } from "@showzy/contract";

export const leak = { createContractClient, readFileSync };
