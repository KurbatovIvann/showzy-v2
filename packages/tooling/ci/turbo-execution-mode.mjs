/**
 * Decide Turbo full vs affected execution for CI (SHO-335).
 *
 * PRs use the workspace package graph (`turbo run --affected`) when the
 * comparison base exists. Pushes to `main` and any unresolved/shallow base
 * run the full workspace suite. Remote cache is never required.
 */

export const TURBO_LOCAL_CACHE = "local:rw";

/**
 * @typedef {"full" | "affected"} TurboExecutionMode
 *
 * @typedef {{
 *   mode: TurboExecutionMode,
 *   reason: string,
 *   scmBase?: string,
 *   scmHead?: string,
 * }} TurboExecutionDecision
 *
 * @typedef {{
 *   eventName: string | undefined,
 *   ref: string | undefined,
 *   baseRef: string | undefined,
 *   baseSha: string | undefined,
 *   mergeBase: string | null,
 * }} TurboExecutionInput
 */

/**
 * @param {string | undefined} ref
 */
export function isMainRef(ref) {
  return ref === "refs/heads/main" || ref === "main";
}

/**
 * @param {TurboExecutionInput} input
 * @returns {TurboExecutionDecision}
 */
export function resolveTurboExecutionMode(input) {
  const eventName = input.eventName ?? "";

  if (eventName === "push" && isMainRef(input.ref)) {
    return { mode: "full", reason: "push-to-main" };
  }

  if (eventName === "pull_request") {
    if (!input.mergeBase) {
      return { mode: "full", reason: "unresolved-base" };
    }
    return {
      mode: "affected",
      reason: "pull-request",
      scmBase: input.mergeBase,
      scmHead: "HEAD",
    };
  }

  return { mode: "full", reason: "non-pr-event" };
}

/**
 * GitHub Actions cache for `.turbo` uses `github.token`. Do not restore or
 * save on untrusted fork PRs (no extra cache credentials, no TURBO_TOKEN).
 *
 * @param {{
 *   eventName: string | undefined,
 *   headRepo: string | undefined,
 *   originRepo: string | undefined,
 * }} input
 */
export function shouldPersistTurboCache(input) {
  if (input.eventName === "pull_request") {
    return (
      Boolean(input.headRepo) &&
      Boolean(input.originRepo) &&
      input.headRepo === input.originRepo
    );
  }
  return true;
}

/**
 * @param {{
 *   eventName: string | undefined,
 *   baseRef: string | undefined,
 *   baseSha: string | undefined,
 *   objectExists: (rev: string) => boolean,
 *   mergeBase: (a: string, b: string) => string | null,
 * }} input
 * @returns {{ ok: true, mergeBase: string, resolvedFrom: string } | { ok: false, reason: string }}
 */
export function resolveComparisonBase(input) {
  if (input.eventName !== "pull_request") {
    return { ok: false, reason: "not-pull-request" };
  }

  /** @type {string[]} */
  const candidates = [];
  if (input.baseSha) {
    candidates.push(input.baseSha);
  }
  if (input.baseRef) {
    candidates.push(`origin/${input.baseRef}`);
    candidates.push(input.baseRef);
  }

  for (const candidate of candidates) {
    if (!input.objectExists(candidate)) {
      continue;
    }
    const mergeBase = input.mergeBase("HEAD", candidate);
    if (mergeBase) {
      return { ok: true, mergeBase, resolvedFrom: candidate };
    }
  }

  return { ok: false, reason: "unresolved-base" };
}

/**
 * @param {string} task
 * @param {TurboExecutionDecision} decision
 * @param {string[]} [extraArgs]
 * @returns {string[]}
 */
export function buildTurboRunArgs(task, decision, extraArgs = []) {
  const args = ["run", task, `--cache=${TURBO_LOCAL_CACHE}`, "--ui=stream"];
  if (decision.mode === "affected") {
    args.push("--affected");
  }
  args.push(...extraArgs);
  return args;
}

/**
 * @param {TurboExecutionDecision} decision
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function buildTurboRunEnv(decision, env = process.env) {
  if (decision.mode !== "affected" || !decision.scmBase) {
    return { ...env };
  }
  return {
    ...env,
    TURBO_SCM_BASE: decision.scmBase,
    TURBO_SCM_HEAD: decision.scmHead ?? "HEAD",
  };
}
