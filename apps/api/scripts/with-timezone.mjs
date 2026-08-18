/**
 * Post-generation codemod, part of `auth:generate` (db.md §4): the better-auth
 * CLI hardcodes bare `timestamp(...)` for Postgres (upstream
 * better-auth#9920), which maps to `timestamp without time zone` and violates
 * the db.md §3 timestamptz convention. This rewrites every generated timestamp
 * column to `{ withTimezone: true }`.
 *
 * Deterministic and idempotent (only bare single-argument `timestamp(...)`
 * calls match), so the committed schema stays byte-reproducible and the CI
 * `auth:check` step keeps working unchanged. Remove once the upstream
 * generator emits timestamptz itself.
 */
import { readFileSync, writeFileSync } from "node:fs";
import console from "node:console";
import process from "node:process";

const target = process.argv[2];
if (target === undefined) {
  console.error("usage: with-timezone.mjs <generated-schema-path>");
  process.exitCode = 2;
} else {
  const source = readFileSync(target, "utf8");
  const patched = source.replaceAll(
    /timestamp\((['"])([A-Za-z0-9_]+)\1\)/g,
    "timestamp($1$2$1, { withTimezone: true })",
  );
  writeFileSync(target, patched);
}
