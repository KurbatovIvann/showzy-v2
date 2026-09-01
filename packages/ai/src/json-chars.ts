/** JSON.stringify character length. 0 when the value cannot be serialized. */
export function staffAssistantJsonChars(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}
