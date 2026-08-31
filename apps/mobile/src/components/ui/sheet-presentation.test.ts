import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sheetDismissTimeoutMs } from "./sheet-dismiss";
import {
  nextSheetGeneration,
  sheetClosePlan,
  sheetOpenMotion,
  shouldCommitSheetHide,
  startSheetHideWatchdog,
} from "./sheet-presentation";

describe("sheet presentation", () => {
  it("increments the generation on each present", () => {
    expect(nextSheetGeneration(0)).toBe(1);
    expect(nextSheetGeneration(1)).toBe(2);
  });

  it("does not hide a newer presentation when an older close generation commits", () => {
    let generation = 0;
    generation = nextSheetGeneration(generation);
    const closing = generation;
    generation = nextSheetGeneration(generation);
    expect(shouldCommitSheetHide(generation, closing)).toBe(false);
    expect(shouldCommitSheetHide(generation, generation)).toBe(true);
  });

  it("snaps open and closed when motion is reduced", () => {
    expect(sheetOpenMotion(true)).toBe("snap");
    expect(sheetOpenMotion(false)).toBe("animate");
    expect(
      sheetClosePlan({ presented: true, reduceMotion: true, generation: 4 }),
    ).toEqual({ kind: "snap" });
    expect(
      sheetClosePlan({ presented: true, reduceMotion: false, generation: 4 }),
    ).toEqual({ kind: "animate", generation: 4 });
  });

  it("idles close when the host was never presented", () => {
    expect(
      sheetClosePlan({ presented: false, reduceMotion: false, generation: 1 }),
    ).toEqual({ kind: "idle" });
  });
});

describe("sheet hide watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("force-hides after the dismiss timeout so an interrupted close cannot stick", () => {
    const hideIfCurrent = vi.fn();
    startSheetHideWatchdog({ generation: 3, hideIfCurrent });
    expect(hideIfCurrent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(sheetDismissTimeoutMs() - 1);
    expect(hideIfCurrent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hideIfCurrent).toHaveBeenCalledOnce();
    expect(hideIfCurrent).toHaveBeenCalledWith(3);
  });

  it("does not fire after cancel (effect cleanup)", () => {
    const hideIfCurrent = vi.fn();
    const stop = startSheetHideWatchdog({ generation: 1, hideIfCurrent });
    stop();
    vi.advanceTimersByTime(sheetDismissTimeoutMs());
    expect(hideIfCurrent).not.toHaveBeenCalled();
  });
});
