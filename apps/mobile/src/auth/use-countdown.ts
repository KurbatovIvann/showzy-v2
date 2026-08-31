import { useEffect, useState } from "react";

export function countdownSecondsRemaining(
  targetMs: number | null,
  nowMs: number,
): number {
  if (targetMs === null) {
    return 0;
  }
  return Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
}

/**
 * Owns the 1s interval for a countdown to `targetMs`. `remaining` is state,
 * so render stays idempotent (no `Date.now()` during render).
 */
export function useCountdown(targetMs: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    countdownSecondsRemaining(targetMs, Date.now()),
  );

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const tick = (): void => {
      const next = countdownSecondsRemaining(targetMs, Date.now());
      setRemaining((prev) => (prev === next ? prev : next));
      if (next <= 0 && intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    tick();
    if (countdownSecondsRemaining(targetMs, Date.now()) <= 0) {
      return;
    }
    intervalId = setInterval(tick, 1000);
    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }
    };
  }, [targetMs]);

  return remaining;
}
