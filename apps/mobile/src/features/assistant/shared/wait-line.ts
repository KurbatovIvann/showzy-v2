/**
 * Locked wait-line pool index. Presentation only — not persisted, not
 * keyed on tool names or façade input (SHO-394).
 */
export function waitLineAt(
  elapsedMs: number,
  lines: readonly string[],
  intervalMs: number,
): string {
  if (lines.length === 0) {
    return "";
  }
  const step = intervalMs > 0 ? intervalMs : 1;
  const elapsed = elapsedMs > 0 ? elapsedMs : 0;
  const index = Math.floor(elapsed / step) % lines.length;
  return lines[index] ?? "";
}
