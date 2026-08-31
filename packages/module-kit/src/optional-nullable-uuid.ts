export function optionalNullableUuid(
  value: string | null | undefined,
): string | null {
  return value ?? null;
}
