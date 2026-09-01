#!/usr/bin/env node
/**
 * Fail-closed aggregator for the `checks` GitHub Actions job (SHO-334).
 *
 * GitHub reports a needed job as success | failure | cancelled | skipped.
 * Only success is allowed. Missing gates, empty results, cancellation, and
 * skips must not produce a green aggregate.
 */
import { appendFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { REQUIRED_QUALITY_GATES } from "./required-quality-gates.mjs";

const SUCCESS = "success";

/**
 * @param {Record<string, string | undefined>} results
 * @param {readonly string[]} required
 * @returns {{ ok: boolean, failures: { name: string, result: string }[] }}
 */
export function evaluateRequiredGates(
  results,
  required = REQUIRED_QUALITY_GATES,
) {
  const failures = [];
  for (const name of required) {
    const result = results[name];
    if (result !== SUCCESS) {
      failures.push({
        name,
        result: result === undefined || result === "" ? "missing" : result,
      });
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
export function parseGateArgs(argv) {
  /** @type {Record<string, string>} */
  const results = {};
  for (const arg of argv) {
    const eq = arg.indexOf("=");
    if (eq <= 0) {
      throw new Error(
        `Expected name=result argument, got ${JSON.stringify(arg)}`,
      );
    }
    results[arg.slice(0, eq)] = arg.slice(eq + 1);
  }
  return results;
}

/**
 * @param {string[]} lines
 * @param {string | undefined} summaryPath
 */
function writeSummary(lines, summaryPath) {
  if (!summaryPath) {
    return;
  }
  appendFileSync(summaryPath, `${lines.join("\n")}\n`);
}

/**
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function runAggregate(argv, env = process.env) {
  let results;
  try {
    results = parseGateArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }

  const { ok, failures } = evaluateRequiredGates(results);
  const rows = REQUIRED_QUALITY_GATES.map((name) => {
    const result = results[name] ?? "missing";
    return `| ${name} | ${result} |`;
  });

  writeSummary(
    [
      "## checks aggregate",
      "",
      "Wall-clock critical path is the **workflow run duration**, not this job.",
      "This aggregator starts after every required worker finishes.",
      "",
      "| Gate | Result |",
      "| --- | --- |",
      ...rows,
      "",
      ok
        ? "All required gates succeeded."
        : "Fail-closed: a required gate was not success.",
    ],
    env.GITHUB_STEP_SUMMARY,
  );

  if (!ok) {
    for (const failure of failures) {
      console.error(
        `Required gate '${failure.name}' result is '${failure.result}' (want success)`,
      );
    }
    return 1;
  }

  console.log("All required gates succeeded.");
  return 0;
}

const invoked =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invoked) {
  process.exitCode = runAggregate(process.argv.slice(2));
}
