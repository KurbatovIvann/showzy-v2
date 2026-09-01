/**
 * Node loader hook: throw if the unit suite loads Testcontainers Postgres.
 * Used by `forbid-testcontainers.mjs` via `module.register`.
 */
const FORBIDDEN = "@testcontainers/postgresql";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === FORBIDDEN || specifier.includes(`${FORBIDDEN}/`)) {
    throw new Error(
      `SHO-336: unit suite must not import ${FORBIDDEN} (global-setup must not run)`,
    );
  }
  return nextResolve(specifier, context);
}
