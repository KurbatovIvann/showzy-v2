/**
 * The CI contract-check stage (fnd-T10): walks the registered composition
 * manifest and fails on any core.md §2 registry-wide violation. Define-time
 * and implement-time rules run implicitly — importing the manifest executes
 * `defineActionContract`/`implementAction` for everything registered, so a
 * broken definition fails this stage before the walk even starts.
 *
 * Run in CI as `pnpm --filter @showzy/core contract:check`.
 */
import { describe, expect, it } from "vitest";

import { runContractCheck } from "./contract-check.js";
import { buildContractCheckStageInput } from "./registered-modules.js";

describe("CI contract-check stage", () => {
  it("the registered surface satisfies every core.md §2 registry rule", () => {
    const result = runContractCheck(buildContractCheckStageInput());
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
