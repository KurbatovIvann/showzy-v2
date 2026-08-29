/** Contract document / order ids are UUIDs; refuse anything else. */
export const DOCUMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidFromParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }
  return DOCUMENT_ID_PATTERN.test(raw) ? raw : null;
}

export function documentIdFromParam(
  value: string | string[] | undefined,
): string | null {
  return uuidFromParam(value);
}

export function orderIdFromParam(
  value: string | string[] | undefined,
): string | null {
  return uuidFromParam(value);
}
