/**
 * RFC 8785 (JCS) canonical JSON serialization and SHA-256 hashing.
 *
 * Used by the audit protocol (core.md §8) for deterministic `inputHash`
 * and reused by the idempotency protocol (fnd-T15) for `requestHash`.
 *
 * Guarantees: given identical logical JSON values, the byte output is
 * identical regardless of original key order. Number formatting follows
 * ECMAScript `Number.prototype.toString()` which matches JCS §3.2.2.3.
 */
import { createHash } from "node:crypto";

import { CoreInvariantError } from "../../errors/index.js";

type JsonPrimitive = string | number | boolean | null;
type JsonArray = readonly JsonSerializable[];
type JsonObject = { readonly [key: string]: JsonSerializable };
export type JsonSerializable = JsonPrimitive | JsonArray | JsonObject;

/**
 * Serialize a value to RFC 8785 canonical JSON. Keys are sorted
 * lexicographically (by UTF-16 code units, matching `Array.prototype.sort`
 * which is what JCS §3.2.3 requires).
 *
 * Throws `CoreInvariantError` for `undefined`, functions, symbols, `NaN`,
 * and `±Infinity` — none of these are valid JSON.
 */
export function canonicalJson(value: JsonSerializable): string {
  return serialize(value);
}

function serialize(value: JsonSerializable): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";

    case "number": {
      if (!Number.isFinite(value)) {
        throw new CoreInvariantError(
          `canonical JSON does not support ${String(value)}`,
        );
      }
      return Object.is(value, -0) ? "0" : String(value);
    }

    case "string":
      return JSON.stringify(value);

    case "object": {
      if (Array.isArray(value)) {
        return "[" + (value as JsonArray).map(serialize).join(",") + "]";
      }
      const obj = value as JsonObject;
      const keys = Object.keys(obj).sort();
      const members = keys.map((key) => {
        const val = obj[key];
        if (val === undefined) {
          throw new CoreInvariantError(
            `canonical JSON does not support undefined value at key "${key}"`,
          );
        }
        return JSON.stringify(key) + ":" + serialize(val);
      });
      return "{" + members.join(",") + "}";
    }

    default:
      throw new CoreInvariantError(
        `canonical JSON does not support type "${typeof value}"`,
      );
  }
}

/**
 * SHA-256 hex digest of the RFC 8785 canonical JSON form.
 * Returns a lowercase 64-character hex string.
 */
export function canonicalJsonSha256(value: JsonSerializable): string {
  const canonical = canonicalJson(value);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
