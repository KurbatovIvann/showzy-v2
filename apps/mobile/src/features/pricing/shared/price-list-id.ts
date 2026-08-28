/** Contract `id` is a UUID; refuse anything else from the route param. */
export const PRICE_LIST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function priceListIdFromParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }
  return PRICE_LIST_ID_PATTERN.test(raw) ? raw : null;
}
