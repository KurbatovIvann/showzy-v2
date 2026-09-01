/**
 * Confirm-then-mutate busy guard shared by list and editor writes
 * (SHO-307). Restore skips `confirm`. Catch leaves the banner to
 * `mutation.error`.
 */
import {
  type ConfirmDialogChoice,
  type ConfirmDialogRequest,
} from "../../../components/ui/confirm-dialog";
import { presentConfirmDialog } from "../../../components/ui/present-confirm-dialog";

export async function runConfirmedWrite(args: {
  readonly busyRef: { current: boolean };
  readonly allowed: boolean;
  readonly confirm?: ConfirmDialogRequest;
  readonly run: () => Promise<void>;
  readonly present?: (
    request: ConfirmDialogRequest,
  ) => Promise<ConfirmDialogChoice>;
}): Promise<void> {
  if (!args.allowed || args.busyRef.current) {
    return;
  }
  if (args.confirm !== undefined) {
    const present = args.present ?? presentConfirmDialog;
    const choice = await present(args.confirm);
    if (choice === "cancel") {
      return;
    }
  }
  args.busyRef.current = true;
  try {
    await args.run();
  } catch {
    // Banner is derived from mutation.error.
  } finally {
    args.busyRef.current = false;
  }
}
