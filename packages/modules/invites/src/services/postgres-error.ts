import { CoreInvariantError, NotFoundError } from "@showzy/core/errors";
import { postgresError } from "@showzy/module-kit/postgres-unique";

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
