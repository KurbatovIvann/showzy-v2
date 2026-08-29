import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";

function postgresError(error: unknown):
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

export function mapInviteWriteError(error: unknown): unknown {
  const pg = postgresError(error);
  if (pg?.code === "23503") {
    return new NotFoundError("The requested resource was not found.", {
      internalMessage: `invites write hit FK ${pg.constraint ?? "unknown"}`,
      cause: error,
    });
  }
  if (
    pg?.code === "23505" &&
    pg.constraint === "company_customer_invites_token_hash_uq"
  ) {
    return new CoreInvariantError(
      "invites.create generated a duplicate token hash",
    );
  }
  return error;
}
