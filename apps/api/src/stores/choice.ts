/**
 * Staff-assistant choice store (SHO-409). In-memory CAS uses the same
 * per-key mutex as OTP/auth rate-limit stores. Cross-process atomicity is
 * Redis Lua in `redis.ts` — not a fourth pattern.
 *
 * Keys are `choice:{choiceId}`. Never GETDEL — that stays confirmation's.
 */
import {
  bindsMatch,
  CHOICE_TTL_MS,
  choiceRedisKey,
  parseChoiceRecord,
  recordBind,
  serializeChoiceRecord,
  type ChoiceBind,
  type ChoiceRecord,
} from "@showzy/ai";

import { withKeyLock } from "./with-key-lock.js";

export type ChoiceClaimDecision =
  | { readonly kind: "claimed"; readonly record: ChoiceRecord }
  | { readonly kind: "replay"; readonly record: ChoiceRecord }
  | { readonly kind: "expired" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid_option" };

export type ChoiceCompleteDecision =
  | { readonly kind: "completed"; readonly record: ChoiceRecord }
  | { readonly kind: "replay"; readonly record: ChoiceRecord }
  | { readonly kind: "expired" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "conflict" };

export type ChoicePeekDecision =
  | { readonly kind: "found"; readonly record: ChoiceRecord }
  | { readonly kind: "expired" }
  | { readonly kind: "forbidden" };

export interface StaffAssistantChoiceStore {
  open(record: ChoiceRecord): Promise<boolean>;
  claim(input: {
    readonly choiceId: string;
    readonly bind: ChoiceBind;
    readonly optionId: string;
  }): Promise<ChoiceClaimDecision>;
  peek(input: {
    readonly choiceId: string;
    readonly bind: ChoiceBind;
  }): Promise<ChoicePeekDecision>;
  complete(input: {
    readonly choiceId: string;
    readonly bind: ChoiceBind;
    readonly optionId: string;
  }): Promise<ChoiceCompleteDecision>;
}

interface MemoryEntry {
  value: string;
  expiresAtMs: number;
}

export function createMemoryChoiceStore(options?: {
  readonly now?: () => number;
  readonly ttlMs?: number;
}): StaffAssistantChoiceStore {
  const now = options?.now ?? Date.now;
  const ttlMs = options?.ttlMs ?? CHOICE_TTL_MS;
  const entries = new Map<string, MemoryEntry>();
  const tails = new Map<string, Promise<void>>();

  function readLive(key: string): ChoiceRecord | undefined {
    const entry = entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAtMs <= now()) {
      entries.delete(key);
      return undefined;
    }
    return parseChoiceRecord(entry.value);
  }

  function write(key: string, record: ChoiceRecord, expiresAtMs: number): void {
    entries.set(key, {
      value: serializeChoiceRecord(record),
      expiresAtMs,
    });
  }

  return {
    open(record) {
      const key = choiceRedisKey(record.choiceId);
      return withKeyLock(tails, key, () => {
        if (readLive(key) !== undefined) {
          return Promise.resolve(false);
        }
        write(key, { ...record, status: "open" }, now() + ttlMs);
        return Promise.resolve(true);
      });
    },

    claim(input) {
      const key = choiceRedisKey(input.choiceId);
      return withKeyLock(tails, key, (): Promise<ChoiceClaimDecision> => {
        const existing = entries.get(key);
        if (existing === undefined || existing.expiresAtMs <= now()) {
          entries.delete(key);
          return Promise.resolve({ kind: "expired" as const });
        }
        const record = parseChoiceRecord(existing.value);
        if (record === undefined) {
          entries.delete(key);
          return Promise.resolve({ kind: "expired" as const });
        }
        if (!bindsMatch(recordBind(record), input.bind)) {
          return Promise.resolve({ kind: "forbidden" as const });
        }
        if (record.optionMap[input.optionId] === undefined) {
          return Promise.resolve({ kind: "invalid_option" as const });
        }
        if (record.status === "open") {
          const claimed: ChoiceRecord = {
            ...record,
            status: "claimed",
            claimedOptionId: input.optionId,
          };
          write(key, claimed, existing.expiresAtMs);
          return Promise.resolve({ kind: "claimed" as const, record: claimed });
        }
        if (record.claimedOptionId === input.optionId) {
          return Promise.resolve({ kind: "replay" as const, record });
        }
        return Promise.resolve({ kind: "conflict" as const });
      });
    },

    peek(input) {
      const key = choiceRedisKey(input.choiceId);
      return withKeyLock(tails, key, (): Promise<ChoicePeekDecision> => {
        const record = readLive(key);
        if (record === undefined) {
          return Promise.resolve({ kind: "expired" as const });
        }
        if (!bindsMatch(recordBind(record), input.bind)) {
          return Promise.resolve({ kind: "forbidden" as const });
        }
        return Promise.resolve({ kind: "found" as const, record });
      });
    },

    complete(input) {
      const key = choiceRedisKey(input.choiceId);
      return withKeyLock(tails, key, (): Promise<ChoiceCompleteDecision> => {
        const existing = entries.get(key);
        if (existing === undefined || existing.expiresAtMs <= now()) {
          entries.delete(key);
          return Promise.resolve({ kind: "expired" as const });
        }
        const record = parseChoiceRecord(existing.value);
        if (record === undefined) {
          entries.delete(key);
          return Promise.resolve({ kind: "expired" as const });
        }
        if (!bindsMatch(recordBind(record), input.bind)) {
          return Promise.resolve({ kind: "forbidden" as const });
        }
        if (record.status === "completed") {
          if (record.claimedOptionId === input.optionId) {
            return Promise.resolve({ kind: "replay" as const, record });
          }
          return Promise.resolve({ kind: "conflict" as const });
        }
        if (
          record.status !== "claimed" ||
          record.claimedOptionId !== input.optionId
        ) {
          return Promise.resolve({ kind: "conflict" as const });
        }
        const completed: ChoiceRecord = {
          ...record,
          status: "completed",
        };
        write(key, completed, existing.expiresAtMs);
        return Promise.resolve({
          kind: "completed" as const,
          record: completed,
        });
      });
    },
  };
}
