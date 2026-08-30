/**
 * Walks `cause` chains (Drizzle wraps pg errors) to a Postgres SQLSTATE
 * and optional constraint name so unique races map to a re-select.
 */
export function postgresError(error: unknown):
  | {
      readonly code: string;
      readonly constraint: string | undefined;
    }
  | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if ("code" in error && typeof error.code === "string") {
    const constraint =
      "constraint" in error && typeof error.constraint === "string"
        ? error.constraint
        : undefined;
    return { code: error.code, constraint };
  }
  if ("cause" in error) {
    return postgresError(error.cause);
  }
  return undefined;
}

export function postgresUniqueConstraint(error: unknown): string | undefined {
  const pg = postgresError(error);
  return pg?.code === "23505" ? pg.constraint : undefined;
}
