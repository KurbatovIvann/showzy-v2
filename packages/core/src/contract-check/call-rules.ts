/**
 * The per-target `ctx.call` rules (core.md §9, ADR-0015), shared verbatim
 * between the registry-walking contract check (fnd-T10 — proves every
 * *declared* edge in CI) and the runtime assert inside `ctx.call`
 * (fnd-T19 — re-proves the *actual* target object of every invocation).
 * One rule list with two enforcement points, so CI and runtime cannot
 * drift.
 */
import type { ActionContract } from "../contract/types.js";

/** `<module>.<verb>` → `<module>` (conventions.mdc naming). */
export function moduleOf(qualifiedName: string): string {
  return qualifiedName.split(".", 1)[0] ?? qualifiedName;
}

export function describePrincipal(contract: ActionContract): string {
  if (contract.principal === "system") {
    return `system/${contract.systemScope ?? "unknown"}`;
  }
  return contract.principal;
}

/**
 * Whether a read call is principal-compatible (core.md §9, ADR-0015):
 * same principal mode by default, with the spec'd asymmetries — account
 * callers may also invoke consumer reads (global discovery), and a global
 * system caller cannot invoke a tenant-scoped system read because it has
 * no `companyId` to propagate (a tenant caller can invoke global system
 * reads, which need nothing tenant-specific).
 */
export function callPrincipalCompatible(
  caller: ActionContract,
  callee: ActionContract,
): boolean {
  if (caller.principal === callee.principal) {
    if (caller.principal === "system") {
      return caller.systemScope === "tenant" || callee.systemScope === "global";
    }
    return true;
  }
  return caller.principal === "account" && callee.principal === "consumer";
}

/**
 * Every §9 rule checkable from the caller/callee contract pair. Returns
 * all violations at once; an empty array means the target is callable.
 */
export function callTargetProblems(
  caller: ActionContract,
  callee: ActionContract,
): string[] {
  const problems: string[] = [];
  if (moduleOf(caller.name) === moduleOf(callee.name)) {
    problems.push(
      "same-module composition uses services/, not ctx.call (ADR-0015)",
    );
  }
  if (callee.risk !== "read") {
    problems.push(
      'only risk: "read" actions are callable cross-module (core.md §9, ADR-0015)',
    );
  }
  if (caller.publicScope === "globalProjection") {
    problems.push(
      "public-global actions cannot use ctx.call — their read capability is limited to the declared projection grant (core.md §9)",
    );
    return problems;
  }
  if (callee.publicScope === "globalProjection") {
    problems.push(
      "a public-global action cannot be a ctx.call target — its projection grant binds only its own anonymous invocation (core.md §2, ADR-0020)",
    );
    return problems;
  }
  if (!callPrincipalCompatible(caller, callee)) {
    problems.push(
      `callee (${describePrincipal(callee)}) does not accept the caller's principal (${describePrincipal(caller)}) (core.md §9, ADR-0015)`,
    );
  }
  return problems;
}
