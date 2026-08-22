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
  "RESEND_API_KEY",
  "SMS_FLY_API_KEY",
]);

const DEFAULT_SMS_FLY_API_URL = "https://sms-fly.ua/api/v2/api.php";

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
  /** Garage (local) needs path-style addressing; R2 in prod does not. */
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  /**
   * Single private bucket (ADR-0027). Local compose/.env.example use
   * `showzy`. Missing or empty fails boot — empty string is unset.
   */
  S3_BUCKET: z.string().min(1),

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

  /**
   * OTP delivery transports. Development/test default to `stub` (no I/O).
   * Production must select the live vendors; adapters are composed in apps/api.
   */
  OTP_EMAIL_TRANSPORT: z.enum(["resend", "stub"]).default("stub"),
  OTP_SMS_TRANSPORT: z.enum(["sms-fly", "stub"]).default("stub"),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.email().optional(),
  RESEND_FROM_NAME: z.string().min(1).optional(),
  SMS_FLY_API_KEY: z.string().min(1).optional(),
  SMS_FLY_API_URL: z
    .url({ protocol: /^https?$/ })
    .default(DEFAULT_SMS_FLY_API_URL),
  SMS_FLY_SENDER: z.string().min(1).optional(),
});

type ParsedEnv = z.infer<typeof envSchema>;

/** Keys the Zod env schema accepts — `.env.example` must list the same set. */
export const ENV_SCHEMA_KEYS: readonly string[] = Object.freeze(
  Object.keys(envSchema.shape),
);

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
    readonly bucket: string;
  };
  readonly auth: {
    readonly secret: string;
    readonly url: string;
  };
  readonly rateLimit: { readonly ipHmacSecret: string };
  readonly http: { readonly port: number };
  readonly trustedProxies: readonly string[];
  readonly sentry: { readonly dsn: string | undefined };
  readonly otpDelivery: {
    readonly email:
      | { readonly transport: "stub" }
      | {
          readonly transport: "resend";
          readonly apiKey: string;
          readonly fromEmail: string;
          readonly fromName: string;
        };
    readonly sms:
      | { readonly transport: "stub"; readonly apiUrl: string }
      | {
          readonly transport: "sms-fly";
          readonly apiKey: string;
          readonly apiUrl: string;
          readonly sender: string;
        };
  };
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
      bucket: parsed.S3_BUCKET,
    },
    auth: {
      secret: parsed.BETTER_AUTH_SECRET,
      url: parsed.BETTER_AUTH_URL,
    },
    rateLimit: { ipHmacSecret: parsed.IP_HMAC_SECRET },
    http: { port: parsed.API_PORT },
    trustedProxies: parsed.TRUSTED_PROXIES,
    sentry: { dsn: parsed.SENTRY_DSN },
    otpDelivery: mapOtpDelivery(parsed),
  };
}

function otpDeliveryIssues(parsed: ParsedEnv): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (parsed.NODE_ENV === "production") {
    if (parsed.OTP_EMAIL_TRANSPORT !== "resend") {
      issues.push({
        key: "OTP_EMAIL_TRANSPORT",
        message: "production requires resend",
      });
    }
    if (parsed.OTP_SMS_TRANSPORT !== "sms-fly") {
      issues.push({
        key: "OTP_SMS_TRANSPORT",
        message: "production requires sms-fly",
      });
    }
  }

  if (parsed.OTP_EMAIL_TRANSPORT === "resend") {
    if (parsed.RESEND_API_KEY === undefined) {
      issues.push({
        key: "RESEND_API_KEY",
        message: "missing required value",
      });
    }
    if (parsed.RESEND_FROM_EMAIL === undefined) {
      issues.push({
        key: "RESEND_FROM_EMAIL",
        message: "missing required value",
      });
    }
    if (parsed.RESEND_FROM_NAME === undefined) {
      issues.push({
        key: "RESEND_FROM_NAME",
        message: "missing required value",
      });
    }
  }

  if (parsed.OTP_SMS_TRANSPORT === "sms-fly") {
    if (parsed.SMS_FLY_API_KEY === undefined) {
      issues.push({
        key: "SMS_FLY_API_KEY",
        message: "missing required value",
      });
    }
    if (parsed.SMS_FLY_SENDER === undefined) {
      issues.push({
        key: "SMS_FLY_SENDER",
        message: "missing required value",
      });
    }
  }

  return issues;
}

function mapOtpDelivery(parsed: ParsedEnv): ServerConfig["otpDelivery"] {
  const issues = otpDeliveryIssues(parsed);
  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    email: mapOtpEmail(parsed),
    sms: mapOtpSms(parsed),
  };
}

function mapOtpEmail(parsed: ParsedEnv): ServerConfig["otpDelivery"]["email"] {
  if (parsed.OTP_EMAIL_TRANSPORT === "resend") {
    const apiKey = parsed.RESEND_API_KEY;
    const fromEmail = parsed.RESEND_FROM_EMAIL;
    const fromName = parsed.RESEND_FROM_NAME;
    if (
      apiKey === undefined ||
      fromEmail === undefined ||
      fromName === undefined
    ) {
      throw new ConfigValidationError(otpDeliveryIssues(parsed));
    }
    return { transport: "resend", apiKey, fromEmail, fromName };
  }
  return { transport: "stub" };
}

function mapOtpSms(parsed: ParsedEnv): ServerConfig["otpDelivery"]["sms"] {
  if (parsed.OTP_SMS_TRANSPORT === "sms-fly") {
    const apiKey = parsed.SMS_FLY_API_KEY;
    const sender = parsed.SMS_FLY_SENDER;
    if (apiKey === undefined || sender === undefined) {
      throw new ConfigValidationError(otpDeliveryIssues(parsed));
    }
    return {
      transport: "sms-fly",
      apiKey,
      apiUrl: parsed.SMS_FLY_API_URL,
      sender,
    };
  }
  return { transport: "stub", apiUrl: parsed.SMS_FLY_API_URL };
}
