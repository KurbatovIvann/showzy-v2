import { useEffect, useState } from "react";

import { waitLineAt } from "../shared/wait-line";

export function useRotatingWaitLine(args: {
  readonly active: boolean;
  readonly lines: readonly string[];
  readonly intervalMs: number;
}): string {
  const [elapsedMs, setElapsedMs] = useState(0);
  const { active, intervalMs } = args;

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }
    setElapsedMs(0);
    const timer = setInterval(() => {
      setElapsedMs((previous) => previous + intervalMs);
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [active, intervalMs]);

  return waitLineAt(elapsedMs, args.lines, intervalMs);
}
