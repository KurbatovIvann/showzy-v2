/**
 * UUIDv7 (RFC 9562 §5.7) — time-ordered event IDs for the outbox
 * (core.md §6: "UUIDv7 (time-ordered), generated in `ctx.emit`").
 *
 * Node's `crypto.randomUUID()` produces only v4, and new dependencies need
 * human approval (prohibitions.mdc), so the 48-bit-timestamp + random layout
 * is implemented here. IDs sort by creation time across milliseconds; the
 * random tail makes collisions negligible within one. Strict ordering of
 * events is **not** this ID's job — that is the per-aggregate sequence.
 */
import { randomBytes } from "node:crypto";

/** Largest timestamp the 48-bit field can carry (~year 10889). */
const MAX_TIMESTAMP_MS = 2 ** 48 - 1;

/** Formats a UUIDv7 for the given epoch-millisecond timestamp. */
export function uuidv7(timestampMs: number): string {
  if (
    !Number.isInteger(timestampMs) ||
    timestampMs < 0 ||
    timestampMs > MAX_TIMESTAMP_MS
  ) {
    throw new RangeError(
      `uuidv7 timestamp ${String(timestampMs)} is outside the 48-bit unsigned range`,
    );
  }

  const bytes = randomBytes(16);
  // unix_ts_ms: 48-bit big-endian milliseconds. Safe in Number arithmetic —
  // 2^48 - 1 is far below MAX_SAFE_INTEGER.
  bytes[0] = Math.floor(timestampMs / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(timestampMs / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(timestampMs / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(timestampMs / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(timestampMs / 2 ** 8) & 0xff;
  bytes[5] = timestampMs & 0xff;
  // ver = 7 (high nibble of byte 6), var = 0b10 (high bits of byte 8); the
  // remaining 74 bits stay random (`rand_a` + `rand_b`).
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
