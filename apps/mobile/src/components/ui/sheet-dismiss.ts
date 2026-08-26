/**
 * Sheet close budget. Presenting a native picker (or a mutation
 * re-render) can interrupt Reanimated's close; iOS then leaves the
 * RN Modal window up and it eats every tap until relaunch. Callers
 * that open ImagePicker must wait at least `sheetDismissWaitMs`
 * (or `Sheet`'s `onHidden`) before presenting.
 */
export const SHEET_MS = 300;
export const SHEET_DISMISS_GRACE_MS = 80;
export const SHEET_DISMISS_COMMIT_MS = 32;

/** Force-unmount the RN Modal if the close animation never finishes. */
export function sheetDismissTimeoutMs(): number {
  return SHEET_MS + SHEET_DISMISS_GRACE_MS;
}

/** Wait long enough for the Modal window to drop after hide. */
export function sheetDismissWaitMs(): number {
  return sheetDismissTimeoutMs() + SHEET_DISMISS_COMMIT_MS;
}

export function waitForSheetDismiss(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, sheetDismissWaitMs());
  });
}

/** `hidden` should resolve from `Sheet` `onHidden` (native Modal dismiss). */
export async function waitForSheetHidden(hidden: Promise<void>): Promise<void> {
  await Promise.race([hidden, waitForSheetDismiss()]);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, SHEET_DISMISS_COMMIT_MS);
  });
}
