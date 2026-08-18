import { z } from "zod";

/**
 * Env keys whose values are credentials or may embed credentials (connection
 * URLs carry passwords, a Sentry DSN carries its key). Validation issues for
 * these keys are redacted before they reach the error message — a boot
 * failure log must never leak a secret (security-operations §4).
 */
const SECRET_ENV_KEYS: ReadonlySet<string> = new Set([
  "DATABASE_URL",
  "DATABASE_MIGRATE_URL",
  "REDIS_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "BETTER_AUTH_SECRET",
  "IP_HMAC_SECRET",
  "SENTRY_DSN",
]);

const trustedProxyEntry = z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Runtime-role connection (`showzy_app` once fnd-T4 creates the roles). */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Migration-role connection; only the CI/deploy migration step needs it. */
  DATABASE_MIGRATE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),

  REDIS_URL: z.url({ protocol: /^rediss?$/ }),

  S3_ENDPOINT: z.url({ protocol: /^https?$/ }),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** MinIO needs path-style addressing; R2 in prod does not. */
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  S3_BUCKET_DOCUMENTS: z.string().min(1).default("documents-bucket"),
  S3_BUCKET_CHAT_ATTACHMENTS: z.string().min(1).default("chat-attachments"),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),

  /**
   * HMAC secret for public rate-limit bucket keys (core.md §10). Rotating
   * IP HMACs must not be derivable from data; this value is injected into
   * `createRateLimitHook` at API boot (fnd-T26).
   */
  IP_HMAC_SECRET: z.string().min(32),

  /** HTTP listen port for `apps/api` (and later `apps/worker` admin if any). */
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /**
   * Comma-separated ingress proxy IPs/CIDRs. Forwarded-IP headers are trusted
   * only from these addresses (security-operations §2); empty means "trust no
   * proxy" — the socket peer address is the client.
   */
  TRUSTED_PROXIES: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    )
    .pipe(z.array(trustedProxyEntry)),

  SENTRY_DSN: z.url().optional(),
});

/** Validated runtime configuration, grouped by concern. */
export interface ServerConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly database: {
    readonly url: string;
    readonly migrateUrl: string | undefined;
  };
  readonly redis: { readonly url: string };
  readonly s3: {
    readonly endpoint: string;
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly forcePathStyle: boolean;
    readonly buckets: {
      readonly documents: string;
      readonly chatAttachments: string;
    };
  };
  readonly auth: {
    readonly secret: string;
    readonly url: string;
  };
  readonly rateLimit: { readonly ipHmacSecret: string };
  readonly http: { readonly port: number };
  readonly trustedProxies: readonly string[];
  readonly sentry: { readonly dsn: string | undefined };
}

/** One redacted, operator-facing validation problem. */
export interface ConfigIssue {
  readonly key: string;
  readonly message: string;
}

/**
 * Thrown by {@link loadServerConfig} when the environment is invalid. Names
 * the offending keys but never their values; safe to log as-is.
 */
export class ConfigValidationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    const lines = issues.map((issue) => `  - ${issue.key}: ${issue.message}`);
    super(`Invalid environment configuration:\n${lines.join("\n")}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

/**
 * Parse and validate the process environment. Call once at process boot and
 * pass the result down explicitly — an invalid environment must crash the
 * process before it serves anything (fail-fast).
 *
 * Empty-string values are treated as unset so a templated `.env` with blank
 * optional lines behaves like a missing line.
 */
export function loadServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const present: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== "") {
      present[key] = value;
    }
  }

  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new ConfigValidationError(
      result.error.issues.map((issue) => {
        const key = String(issue.path[0] ?? "(root)");
        if (!(key in present)) {
          return { key, message: "missing required value" };
        }
        if (SECRET_ENV_KEYS.has(key)) {
          return {
            key,
            message: "invalid value (redacted — see .env.example)",
          };
        }
        return { key, message: issue.message };
      }),
    );
  }

  const parsed = result.data;
  return {
    nodeEnv: parsed.NODE_ENV,
    database: {
      url: parsed.DATABASE_URL,
      migrateUrl: parsed.DATABASE_MIGRATE_URL,
    },
    redis: { url: parsed.REDIS_URL },
    s3: {
      endpoint: parsed.S3_ENDPOINT,
      region: parsed.S3_REGION,
      accessKeyId: parsed.S3_ACCESS_KEY_ID,
      secretAccessKey: parsed.S3_SECRET_ACCESS_KEY,
      forcePathStyle: parsed.S3_FORCE_PATH_STYLE,
      buckets: {
        documents: parsed.S3_BUCKET_DOCUMENTS,
        chatAttachments: parsed.S3_BUCKET_CHAT_ATTACHMENTS,
      },
    },
    auth: {
      secret: parsed.BETTER_AUTH_SECRET,
      url: parsed.BETTER_AUTH_URL,
    },
    rateLimit: { ipHmacSecret: parsed.IP_HMAC_SECRET },
    http: { port: parsed.API_PORT },
    trustedProxies: parsed.TRUSTED_PROXIES,
    sentry: { dsn: parsed.SENTRY_DSN },
  };
}
