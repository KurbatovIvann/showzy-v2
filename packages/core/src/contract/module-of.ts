/**
 * `<module>.<verb>` → `<module>` (conventions.mdc naming). One
 * implementation shared by contract definition and the contract-check
 * tooling so the two cannot drift.
 */
export function moduleOf(qualifiedName: string): string {
  return qualifiedName.split(".", 1)[0] ?? qualifiedName;
}
