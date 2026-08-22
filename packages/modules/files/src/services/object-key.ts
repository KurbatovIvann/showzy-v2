/** Server-derived catalog object key (security-operations.md §3). */
export function catalogObjectKey(companyId: string, fileId: string): string {
  return `${companyId}/catalog/${fileId}`;
}
