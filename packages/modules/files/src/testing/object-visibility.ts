/**
 * Test-only HeadObject barrier for Garage/R2. PutObject and DeleteObject
 * can acknowledge before HeadObject sees the new state. Sweep treats a
 * missing HEAD as already purged, so tests must poll HEAD rather than
 * sleep a fixed duration.
 *
 * Not exported from `@showzy/files` (actions/events only).
 */

export type ObjectHeadExpectation = "present" | "missing";

export interface ObjectHeadStore {
  readonly headObject: (key: string) => Promise<unknown>;
}

/** Backoff between HeadObject polls — not a visibility sleep. */
export const OBJECT_HEAD_POLL_MS = 25;

export const OBJECT_HEAD_TIMEOUT_MS = 10_000;

export async function waitForObjectVisibility(
  store: ObjectHeadStore,
  key: string,
  expected: ObjectHeadExpectation,
  timeoutMs = OBJECT_HEAD_TIMEOUT_MS,
): Promise<void> {
  const started = Date.now();
  for (;;) {
    const head = await store.headObject(key);
    const missing = head === "missing";
    const matches = expected === "missing" ? missing : !missing;
    if (matches) {
      return;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        expected === "missing"
          ? "timed out waiting for HeadObject missing"
          : "timed out waiting for HeadObject present",
      );
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, OBJECT_HEAD_POLL_MS);
    });
  }
}
