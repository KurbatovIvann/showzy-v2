import { sheetDismissTimeoutMs } from "./sheet-dismiss";

export type SheetMotion = "snap" | "animate";

export type SheetClosePlan =
  | { readonly kind: "idle" }
  | { readonly kind: "snap" }
  | { readonly kind: "animate"; readonly generation: number };

export function nextSheetGeneration(current: number): number {
  return current + 1;
}

export function shouldCommitSheetHide(
  currentGeneration: number,
  closeGeneration: number,
): boolean {
  return currentGeneration === closeGeneration;
}

export function sheetOpenMotion(reduceMotion: boolean): SheetMotion {
  return reduceMotion ? "snap" : "animate";
}

export function sheetClosePlan(args: {
  readonly presented: boolean;
  readonly reduceMotion: boolean;
  readonly generation: number;
}): SheetClosePlan {
  if (!args.presented) {
    return { kind: "idle" };
  }
  if (args.reduceMotion) {
    return { kind: "snap" };
  }
  return { kind: "animate", generation: args.generation };
}

/** Force-unmount the RN Modal if the close animation never finishes. */
export function startSheetHideWatchdog(args: {
  readonly generation: number;
  readonly hideIfCurrent: (generation: number) => void;
}): () => void {
  const timeout = setTimeout(() => {
    args.hideIfCurrent(args.generation);
  }, sheetDismissTimeoutMs());
  return () => {
    clearTimeout(timeout);
  };
}
