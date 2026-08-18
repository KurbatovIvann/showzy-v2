/**
 * The contract.md §4 error-mapping table — the single client-safe source
 * for wire codes, HTTP statuses, and the typed extras each code carries.
 *
 * Wire codes are pinned to the core error vocabulary (core.md §11):
 * renaming one is a breaking client API change and goes through spec
 * rework, never a casual refactor. The table test enforces the exact §4
 * rows; `satisfies Record<CoreErrorCode, …>` keeps the table complete when
 * core gains an error class.
 */
import { ORPCError } from "@orpc/client";
import type { CoreErrorCode } from "@showzy/core/errors";
import { z } from "zod";

/** HTTP status per wire code — exactly the §4 table. */
export const wireErrorStatus = {
  VALIDATION: 400,
  PERMISSION_DENIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  RETRY_IN_PROGRESS: 409,
  CONFIRMATION_REQUIRED: 409,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  INTERNAL: 500,
} as const satisfies Record<CoreErrorCode, number>;

/** The stable wire-code union clients discriminate on (contract.md §4). */
export type WireErrorCode = keyof typeof wireErrorStatus;

/**
 * One serialized Zod issue (§4: `VALIDATION` "+ Zod issues"). Loose on
 * purpose: issues carry per-code extras (`expected`, `origin`, …) that
 * must survive the wire; only the universally present fields are pinned.
 */
export const wireValidationIssueSchema = z.looseObject({
  code: z.string(),
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

/**
 * The client-visible part of a confirmation challenge (core.md §7). Only
 * these fields may cross the wire — the full server record (input hash,
 * principal key, company, idempotency key) stays in Redis.
 */
export const wireConfirmationChallengeSchema = z.object({
  challengeId: z.string(),
  /** Redacted human-readable summary from `confirmationSummary`. */
  summary: z.string(),
  /** ISO-8601 expiry — five minutes from issuance (core.md §7). */
  expiresAt: z.string(),
});

/**
 * The oRPC type-safe error map attached to every contract procedure.
 * Clients get a discriminated union typed by wire code — no string
 * matching (contract.md §4). Codes without a `data` schema carry no
 * payload beyond `code`/`message`/`status`; `INTERNAL` sends no details
 * on the wire by construction (the server maps it from a fixed generic
 * client message).
 */
export const wireErrorDefinitions = {
  VALIDATION: {
    status: wireErrorStatus.VALIDATION,
    data: z.object({ issues: z.array(wireValidationIssueSchema) }),
  },
  PERMISSION_DENIED: { status: wireErrorStatus.PERMISSION_DENIED },
  NOT_FOUND: { status: wireErrorStatus.NOT_FOUND },
  CONFLICT: { status: wireErrorStatus.CONFLICT },
  IDEMPOTENCY_CONFLICT: { status: wireErrorStatus.IDEMPOTENCY_CONFLICT },
  RETRY_IN_PROGRESS: {
    status: wireErrorStatus.RETRY_IN_PROGRESS,
    data: z.object({ retryAfterSec: z.number() }),
  },
  CONFIRMATION_REQUIRED: {
    status: wireErrorStatus.CONFIRMATION_REQUIRED,
    data: z.object({ challenge: wireConfirmationChallengeSchema }),
  },
  RATE_LIMITED: {
    status: wireErrorStatus.RATE_LIMITED,
    data: z.object({ retryAfterSec: z.number() }),
  },
  TIMEOUT: { status: wireErrorStatus.TIMEOUT },
  INTERNAL: { status: wireErrorStatus.INTERNAL },
} as const;

type WireErrorDefinition = (typeof wireErrorDefinitions)[WireErrorCode];

type WireErrorData<K extends WireErrorCode> =
  "data" extends keyof (typeof wireErrorDefinitions)[K]
    ? z.infer<(typeof wireErrorDefinitions)[K]["data"]>
    : never;

/**
 * Discriminated union of defined wire errors. Narrow by `error.code` —
 * never by matching `message` text (contract.md §4).
 */
export type WireError = {
  [K in WireErrorCode]: [WireErrorData<K>] extends [never]
    ? {
        readonly code: K;
        readonly status: (typeof wireErrorStatus)[K];
        readonly message: string;
      }
    : {
        readonly code: K;
        readonly status: (typeof wireErrorStatus)[K];
        readonly message: string;
        readonly data: WireErrorData<K>;
      };
}[WireErrorCode];

function isWireErrorCode(code: string): code is WireErrorCode {
  return Object.hasOwn(wireErrorStatus, code);
}

function definitionHasData(
  definition: WireErrorDefinition,
): definition is WireErrorDefinition & { readonly data: z.ZodType } {
  return "data" in definition;
}

/**
 * True when `error` is a contract.md §4 wire error. After this guard,
 * `error.code` narrows the extras (`issues`, `retryAfterSec`,
 * `challenge`) without string matching.
 */
export function isWireError(error: unknown): error is WireError {
  if (!(error instanceof ORPCError)) {
    return false;
  }
  const code: unknown = error.code;
  if (typeof code !== "string" || !isWireErrorCode(code)) {
    return false;
  }
  if (error.status !== wireErrorStatus[code]) {
    return false;
  }
  const definition = wireErrorDefinitions[code];
  if (definitionHasData(definition)) {
    return definition.data.safeParse(error.data).success;
  }
  return true;
}
