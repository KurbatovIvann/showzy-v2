import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ConfigValidationError,
  ENV_SCHEMA_KEYS,
  loadServerConfig,
} from "./config.js";

/** A fully specified, valid environment (mirrors `.env.example`). */
function validEnv(): Record<string, string> {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://showzy:showzy@localhost:5432/showzy",
    DATABASE_MIGRATE_URL:
      "postgresql://showzy_migrate:showzy@localhost:5432/showzy",
    REDIS_URL: "redis://localhost:6379",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "showzy-local",
    S3_SECRET_ACCESS_KEY: "showzy-local-secret",
    S3_FORCE_PATH_STYLE: "true",
    S3_BUCKET_DOCUMENTS: "documents-bucket",
    S3_BUCKET_CHAT_ATTACHMENTS: "chat-attachments",
    BETTER_AUTH_SECRET: "dev-only-secret-change-me-0000000000",
    BETTER_AUTH_URL: "http://localhost:3000",
    IP_HMAC_SECRET: "dev-only-ip-hmac-secret-change-me-00",
    TRUSTED_PROXIES: "10.0.0.1, 172.16.0.0/12",
    SENTRY_DSN: "https://key@sentry.example.com/42",
  };
}

describe("loadServerConfig", () => {
  it("parses a fully specified environment into the grouped config", () => {
    const config = loadServerConfig(validEnv());

    expect(config.nodeEnv).toBe("test");
    expect(config.database.url).toBe(
      "postgresql://showzy:showzy@localhost:5432/showzy",
    );
    expect(config.database.migrateUrl).toBe(
      "postgresql://showzy_migrate:showzy@localhost:5432/showzy",
    );
    expect(config.redis.url).toBe("redis://localhost:6379");
    expect(config.s3.endpoint).toBe("http://localhost:9000");
    expect(config.s3.forcePathStyle).toBe(true);
    expect(config.s3.buckets).toEqual({
      documents: "documents-bucket",
      chatAttachments: "chat-attachments",
    });
    expect(config.auth.url).toBe("http://localhost:3000");
    expect(config.rateLimit.ipHmacSecret).toBe(
      "dev-only-ip-hmac-secret-change-me-00",
    );
    expect(config.http.port).toBe(3000);
    expect(config.trustedProxies).toEqual(["10.0.0.1", "172.16.0.0/12"]);
    expect(config.sentry.dsn).toBe("https://key@sentry.example.com/42");
  });

  it("applies defaults for optional keys", () => {
    const env = validEnv();
    delete env["NODE_ENV"];
    delete env["DATABASE_MIGRATE_URL"];
    delete env["S3_REGION"];
    delete env["S3_FORCE_PATH_STYLE"];
    delete env["S3_BUCKET_DOCUMENTS"];
    delete env["S3_BUCKET_CHAT_ATTACHMENTS"];
    delete env["TRUSTED_PROXIES"];
    delete env["SENTRY_DSN"];
    delete env["API_PORT"];

    const config = loadServerConfig(env);

    expect(config.nodeEnv).toBe("development");
    expect(config.http.port).toBe(3000);
    expect(config.database.migrateUrl).toBeUndefined();
    expect(config.s3.region).toBe("us-east-1");
    expect(config.s3.forcePathStyle).toBe(false);
    expect(config.s3.buckets).toEqual({
      documents: "documents-bucket",
      chatAttachments: "chat-attachments",
    });
    expect(config.trustedProxies).toEqual([]);
    expect(config.sentry.dsn).toBeUndefined();
  });

  it("fails fast on missing required keys and reports every one of them", () => {
    const env = validEnv();
    delete env["DATABASE_URL"];
    delete env["BETTER_AUTH_SECRET"];
    delete env["IP_HMAC_SECRET"];

    const load = () => loadServerConfig(env);

    expect(load).toThrow(ConfigValidationError);
    try {
      load();
    } catch (error) {
      const configError = error as ConfigValidationError;
      expect(configError.message).toContain("DATABASE_URL");
      expect(configError.message).toContain("BETTER_AUTH_SECRET");
      expect(configError.message).toContain("IP_HMAC_SECRET");
      expect(configError.message).toContain("missing");
    }
  });

  it("fails fast on invalid values and aggregates all offending keys", () => {
    const env = validEnv();
    env["NODE_ENV"] = "staging";
    env["REDIS_URL"] = "http://not-redis:6379";
    env["TRUSTED_PROXIES"] = "10.0.0.1, not-an-ip";

    const load = () => loadServerConfig(env);

    expect(load).toThrow(ConfigValidationError);
    try {
      load();
    } catch (error) {
      const configError = error as ConfigValidationError;
      expect(configError.message).toContain("NODE_ENV");
      expect(configError.message).toContain("REDIS_URL");
      expect(configError.message).toContain("TRUSTED_PROXIES");
    }
  });

  it("never echoes secret values in the error, its issues, or nested causes", () => {
    const env = validEnv();
    // Each invalid secret carries a unique sentinel that must not surface.
    env["DATABASE_URL"] =
      "mysql://showzy:DB_PASSWORD_SENTINEL@localhost:3306/showzy";
    env["REDIS_URL"] = "redis-wrong://:REDIS_PASSWORD_SENTINEL@localhost:6379";
    env["BETTER_AUTH_SECRET"] = "AUTH_SECRET_SENTINEL";
    env["IP_HMAC_SECRET"] = "IP_HMAC_SECRET_SENTINEL";
    env["SENTRY_DSN"] = "not-a-url-SENTRY_KEY_SENTINEL";

    let thrown: unknown;
    try {
      loadServerConfig(env);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigValidationError);
    const configError = thrown as ConfigValidationError;
    // The offending keys are named so the operator knows what to fix...
    expect(configError.message).toContain("DATABASE_URL");
    expect(configError.message).toContain("REDIS_URL");
    expect(configError.message).toContain("BETTER_AUTH_SECRET");
    expect(configError.message).toContain("IP_HMAC_SECRET");
    expect(configError.message).toContain("SENTRY_DSN");
    // ...but no serialization of the error may contain a secret value.
    const everything = JSON.stringify({
      message: configError.message,
      issues: configError.issues,
      stack: configError.stack,
      cause: configError.cause,
    });
    expect(everything).not.toContain("SENTINEL");
  });

  it("treats empty strings as missing values", () => {
    const optional = validEnv();
    optional["SENTRY_DSN"] = "";
    expect(loadServerConfig(optional).sentry.dsn).toBeUndefined();

    const required = validEnv();
    required["DATABASE_URL"] = "";
    expect(() => loadServerConfig(required)).toThrow(ConfigValidationError);
    try {
      loadServerConfig(required);
    } catch (error) {
      expect((error as ConfigValidationError).message).toContain("missing");
    }
  });
});

describe("ENV_SCHEMA_KEYS vs .env.example", () => {
  it("lists the same keys the Zod env schema accepts", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../../.env.example", import.meta.url)),
      { encoding: "utf8" },
    );
    const exampleKeys = new Set<string>();
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      exampleKeys.add(trimmed.slice(0, eq));
    }
    expect([...exampleKeys].sort()).toEqual([...ENV_SCHEMA_KEYS].sort());
  });
});
