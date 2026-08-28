/**
 * Walks `cause` chains (Drizzle wraps pg errors) to a unique-violation
 * (SQLSTATE 23505) constraint name, so group create can retry a colliding
 * slug without treating other constraint failures as a slug race.
 */
export function postgresUniqueConstraint(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if (
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    typeof error.constraint === "string"
  ) {
    return error.constraint;
  }
  if ("cause" in error) {
    return postgresUniqueConstraint(error.cause);
  }
  return undefined;
}
