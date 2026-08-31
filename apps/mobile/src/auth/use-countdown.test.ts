import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./react-test-dom";
import { countdownSecondsRemaining, useCountdown } from "./use-countdown";

type ProbeProps = {
  readonly targetMs: number | null;
  readonly latest: { current: number };
};

function Probe({ targetMs, latest }: ProbeProps) {
  latest.current = useCountdown(targetMs);
  return null;
}

type Mounted = {
  latest: () => number;
  rerender: (targetMs: number | null) => void;
  unmount: () => void;
};

function mount(targetMs: number | null): Mounted {
  const latest = { current: 0 };
  const container = globalThis.document.createElement("div");
  const root: Root = createRoot(container);

  const render = (nextTargetMs: number | null) => {
    act(() => {
      root.render(createElement(Probe, { targetMs: nextTargetMs, latest }));
    });
  };

  render(targetMs);

  return {
    latest: () => latest.current,
    rerender: render,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("countdownSecondsRemaining", () => {
  it("is zero without a target and never negative", () => {
    expect(countdownSecondsRemaining(null, 1_000)).toBe(0);
    expect(countdownSecondsRemaining(500, 1_000)).toBe(0);
  });

  it("ceils remaining milliseconds to whole seconds", () => {
    expect(countdownSecondsRemaining(2_500, 0)).toBe(3);
    expect(countdownSecondsRemaining(1_000, 0)).toBe(1);
  });
});

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero when there is no target and does not start an interval", () => {
    const hooked = mount(null);
    expect(hooked.latest()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    hooked.unmount();
  });

  it("ticks remaining down once a second until zero", () => {
    const hooked = mount(2_500);
    expect(hooked.latest()).toBe(3);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(hooked.latest()).toBe(2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(hooked.latest()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(hooked.latest()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    hooked.unmount();
  });

  it("resets when the target changes", () => {
    const hooked = mount(2_000);
    expect(hooked.latest()).toBe(2);
    hooked.rerender(5_000);
    expect(hooked.latest()).toBe(5);
    hooked.unmount();
  });

  it("clears the interval on unmount", () => {
    const hooked = mount(5_000);
    expect(vi.getTimerCount()).toBe(1);
    hooked.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
