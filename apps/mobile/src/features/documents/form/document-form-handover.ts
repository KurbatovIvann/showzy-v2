/**
 * Post-create leave after handover close (SHO-238). Android RN Modal
 * `onDismiss` (Sheet `onHidden`) is iOS-only — race `onHidden` with
 * `waitForSheetHidden` like list options. Do not read chrome `visible`.
 */
export function shouldReplaceToListAfterHandoverClose(args: {
  readonly created: boolean;
}): boolean {
  return args.created;
}

export async function waitThenReplaceAfterCreateHandover(args: {
  readonly created: boolean;
  readonly waitHidden: () => Promise<void>;
  readonly hide: () => void;
  readonly replace: () => void;
}): Promise<void> {
  if (!shouldReplaceToListAfterHandoverClose({ created: args.created })) {
    args.hide();
    return;
  }
  const hidden = args.waitHidden();
  args.hide();
  await hidden;
  args.replace();
}
