/** Joins conditional class fragments; no dependency (SHO-311). */
export function cx(
  ...parts: ReadonlyArray<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
