import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createProcessShutdown } from "./shutdown.js";

const silent = pino({ enabled: false });

describe("createProcessShutdown", () => {
  it("runs close and flush once when two shutdowns overlap", async () => {
    let closes = 0;
    let flushes = 0;
    let releaseClose: (() => void) | undefined;
    const shutdown = createProcessShutdown({
      logger: silent,
      close: () => {
        closes += 1;
        return new Promise((resolve) => {
          releaseClose = resolve;
        });
      },
      flush: () => {
        flushes += 1;
        return Promise.resolve();
      },
    });

    const first = shutdown.run();
    const second = shutdown.run();
    expect(closes).toBe(1);
    if (releaseClose === undefined) {
      throw new Error("expected close to start");
    }
    releaseClose();
    await Promise.all([first, second]);
    expect(closes).toBe(1);
    expect(flushes).toBe(1);
  });

  it("still flushes Sentry after close throws", async () => {
    let flushed = false;
    const shutdown = createProcessShutdown({
      logger: silent,
      close: () => Promise.reject(new Error("pool already ended")),
      flush: () => {
        flushed = true;
        return Promise.resolve();
      },
    });

    await shutdown.run();
    expect(flushed).toBe(true);
  });
});
