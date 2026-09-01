import { describe, expect, it, vi } from "vitest";

import { runConfirmedWrite } from "./confirmed-write";

describe("runConfirmedWrite", () => {
  it("no-ops when disallowed or already busy", async () => {
    const run = vi.fn(() => Promise.resolve());
    const busyRef = { current: false };
    await runConfirmedWrite({
      busyRef,
      allowed: false,
      run,
    });
    expect(run).not.toHaveBeenCalled();
    busyRef.current = true;
    await runConfirmedWrite({
      busyRef,
      allowed: true,
      run,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("skips run when the user cancels the confirm dialog", async () => {
    const run = vi.fn(() => Promise.resolve());
    const present = vi.fn(() => Promise.resolve("cancel" as const));
    await runConfirmedWrite({
      busyRef: { current: false },
      allowed: true,
      confirm: {
        title: "Archive",
        message: "Sure?",
        confirmLabel: "Archive",
        cancelLabel: "Cancel",
        tone: "default",
      },
      run,
      present,
    });
    expect(present).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
  });

  it("runs after confirm and clears the busy flag even when run rejects", async () => {
    const busyRef = { current: false };
    const present = vi.fn(() => Promise.resolve("confirm" as const));
    await runConfirmedWrite({
      busyRef,
      allowed: true,
      confirm: {
        title: "Delete",
        message: "Gone",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        tone: "danger",
      },
      run: () => Promise.reject(new TypeError("Failed to fetch")),
      present,
    });
    expect(busyRef.current).toBe(false);
  });

  it("runs without a dialog when confirm is omitted", async () => {
    const run = vi.fn(() => Promise.resolve());
    await runConfirmedWrite({
      busyRef: { current: false },
      allowed: true,
      run,
    });
    expect(run).toHaveBeenCalledOnce();
  });
});
