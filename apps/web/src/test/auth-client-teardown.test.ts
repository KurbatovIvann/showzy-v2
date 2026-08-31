/**
 * SHO-317: better-auth's session atom delays broadcast-channel destroy
 * (`cleanupBroadcastSetup` → `window.removeEventListener`) by nanostores
 * `STORE_UNMOUNT_DELAY` (1000ms). After a green `app.test.tsx` suite,
 * Vitest tears down jsdom first and the leftover timer throws
 * `ReferenceError: window is not defined`.
 *
 * This pin would fail if dispose were a no-op: unmount only *schedules*
 * destroy, so `removeEventListener("storage")` would not run until after
 * the delay — the CI window-gone window.
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { disposeShowzyAuthClient } from "../auth/client";
import { renderApp } from "./render";

afterEach(cleanup);

/** nanostores `STORE_UNMOUNT_DELAY` plus a tick. */
const NANO_STORES_UNMOUNT_DELAY_MS = 1_000;
const AFTER_UNMOUNT_DELAY_MS = NANO_STORES_UNMOUNT_DELAY_MS + 250;

describe("auth client teardown (SHO-317)", () => {
  it("runs cleanupBroadcastSetup while window exists and the delayed nanostores destroy is a no-op", async () => {
    const { authClient } = await renderApp("/sign-in");
    cleanup();

    const removeEventListener = vi.spyOn(window, "removeEventListener");
    expect(
      removeEventListener.mock.calls.some((call) => call[0] === "storage"),
    ).toBe(false);

    disposeShowzyAuthClient(authClient);

    expect(
      removeEventListener.mock.calls.some((call) => call[0] === "storage"),
    ).toBe(true);

    removeEventListener.mockClear();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, AFTER_UNMOUNT_DELAY_MS);
    });
    expect(removeEventListener).not.toHaveBeenCalled();
    removeEventListener.mockRestore();
  });
});
