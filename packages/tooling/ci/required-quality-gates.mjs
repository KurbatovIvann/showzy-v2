/**
 * Worker jobs the `checks` aggregator requires. Names match GitHub Actions
 * job ids in `.github/workflows/ci.yml` (SHO-334, SHO-336). The aggregator
 * job itself is not listed — it cannot need itself.
 */
export const REQUIRED_QUALITY_GATES = Object.freeze([
  "format",
  "typecheck",
  "lint",
  "test-unit",
  "test-db",
  "build-smoke",
  "secret-scan",
  "dependency-audit",
  "contract-check",
  "migration-drift",
  "bundle-probe",
  "e2e-smoke",
]);
