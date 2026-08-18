/**
 * Redis adapters mounted by `apps/api` at boot (fnd-T26). Core stays
 * dependency-free: these implementations must match the in-memory
 * reference stores in `@showzy/core` (token-bucket continuous refill,
 * confirmation `GETDEL`).
 */
import type { ConfirmationStore, RateLimitStore } from "@showzy/core";
import type { Redis } from "ioredis";

import type { OtpSendStore } from "../auth/otp-send-guard.js";
import type { SecondaryStorage } from "./memory.js";

/** Adapter failure — the rate-limit/confirmation hooks own fail-open/closed. */
export class RedisStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedisStoreError";
  }
}

const TOKEN_BUCKET_LUA = `
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])

local data = redis.call('HMGET', KEYS[1], 'tokens', 'updatedAtMs')
local tokens = tonumber(data[1])
local updatedAtMs = tonumber(data[2])

if tokens == nil then
  tokens = limit
  updatedAtMs = nowMs
end

local elapsedMs = math.max(0, nowMs - updatedAtMs)
local refill = (elapsedMs / 1000.0) * (limit / windowSec)
tokens = math.min(limit, tokens + refill)

if tokens < 1 then
  redis.call('HSET', KEYS[1], 'tokens', tokens, 'updatedAtMs', nowMs)
  redis.call('EXPIRE', KEYS[1], math.ceil(windowSec * 2))
  local secondsPerToken = windowSec / limit
  local retryAfterSec = math.max(1, math.ceil((1 - tokens) * secondsPerToken))
  return {0, retryAfterSec}
end

tokens = tokens - 1
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updatedAtMs', nowMs)
redis.call('EXPIRE', KEYS[1], math.ceil(windowSec * 2))
return {1, 0}
`;

const OTP_SEND_LUA = `
local nowMs = tonumber(ARGV[1])
local cooldownMs = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local maxSends = tonumber(ARGV[4])
local ttlSec = tonumber(ARGV[5])
local windowStart = nowMs - windowMs
local raw = redis.call('GET', KEYS[1])
local recent = {}
if type(raw) == 'string' and raw ~= '' then
  local ok, parsed = pcall(cjson.decode, raw)
  if ok and type(parsed) == 'table' then
    for i = 1, #parsed do
      local ts = tonumber(parsed[i])
      if ts ~= nil and ts > windowStart then
        table.insert(recent, ts)
      end
    end
  end
end
if #recent > 0 then
  local last = recent[#recent]
  local cooldownEnds = last + cooldownMs
  if nowMs < cooldownEnds then
    return {0, math.ceil((cooldownEnds - nowMs) / 1000)}
  end
end
if #recent >= maxSends then
  local oldest = recent[1]
  local wait = math.max(1, math.ceil((oldest + windowMs - nowMs) / 1000))
  return {0, wait}
end
table.insert(recent, nowMs)
redis.call('SET', KEYS[1], cjson.encode(recent), 'EX', ttlSec)
return {1, 0}
`;

export function createRedisSecondaryStorage(redis: Redis): SecondaryStorage {
  return {
    get(key) {
      return redis.get(key);
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await redis.set(key, value, "EX", ttlSeconds);
        return;
      }
      await redis.set(key, value);
    },
    async delete(key) {
      await redis.del(key);
    },
    async getAndDelete(key) {
      const value = await redis.call("GETDEL", key);
      return typeof value === "string" ? value : null;
    },
  };
}

export function createRedisConfirmationStore(redis: Redis): ConfirmationStore {
  return {
    async set(key, value, ttlMs) {
      await redis.set(key, value, "PX", ttlMs);
    },
    async getAndDelete(key) {
      const value = await redis.call("GETDEL", key);
      return typeof value === "string" ? value : null;
    },
  };
}

export function createRedisOtpSendStore(redis: Redis): OtpSendStore {
  return {
    async tryRecordSend(attempt) {
      const result = await redis.eval(
        OTP_SEND_LUA,
        1,
        attempt.key,
        String(attempt.nowMs),
        String(attempt.cooldownMs),
        String(attempt.windowMs),
        String(attempt.maxSends),
        String(attempt.ttlSeconds),
      );
      return parseOtpSendResult(result);
    },
  };
}

export function createRedisRateLimitStore(
  redis: Redis,
  options?: { readonly now?: () => number },
): RateLimitStore {
  const now = options?.now ?? Date.now;
  return {
    async consume(request) {
      const result = await redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        request.key,
        String(request.limit),
        String(request.windowSec),
        String(now()),
      );
      return parseTokenBucketResult(result);
    },
  };
}

function parseTokenBucketResult(
  result: unknown,
):
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSec: number } {
  if (!Array.isArray(result) || result.length === 0) {
    throw new RedisStoreError(
      "rate-limit Redis script returned an unexpected value",
    );
  }
  const allowedFlag = Number(result[0]);
  if (allowedFlag === 1) {
    return { allowed: true };
  }
  const retryAfterSec = Number(result[1]);
  return {
    allowed: false,
    retryAfterSec:
      Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 1,
  };
}

function parseOtpSendResult(
  result: unknown,
):
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number } {
  if (!Array.isArray(result) || result.length === 0) {
    throw new RedisStoreError(
      "otp-send Redis script returned an unexpected value",
    );
  }
  const allowedFlag = Number(result[0]);
  if (allowedFlag === 1) {
    return { allowed: true };
  }
  const retryAfterSeconds = Number(result[1]);
  return {
    allowed: false,
    retryAfterSeconds:
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds
        : 1,
  };
}
