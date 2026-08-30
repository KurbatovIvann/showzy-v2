import { describe, expect, it } from "vitest";

import { postgresUniqueConstraint } from "./postgres-unique.js";

describe("postgresUniqueConstraint", () => {
  it("reads SQLSTATE 23505 from a cause chain", () => {
    expect(
      postgresUniqueConstraint({
        cause: {
          code: "23505",
          constraint: "signing_requests_document_id_pending_uq",
        },
      }),
    ).toBe("signing_requests_document_id_pending_uq");
    expect(postgresUniqueConstraint(undefined)).toBeUndefined();
    expect(
      postgresUniqueConstraint({
        code: "23503",
        constraint: "signing_requests_document_id_pending_uq",
      }),
    ).toBeUndefined();
  });
});
