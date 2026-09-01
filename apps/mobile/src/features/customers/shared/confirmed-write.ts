/**
 * Confirm-then-mutate busy guard shared by list and editor writes
 * (SHO-307). Restore skips `confirm`. Catch leaves the banner to
 * `mutation.error`. RN `Alert` stays in the hook via `present`.
 */
import {
  type ConfirmDialogChoice,
  type ConfirmDialogRequest,
} from "../../../components/ui/confirm-dialog";

export async function runConfirmedWrite(
  args: {
    readonly busyRef: { current: boolean };
    readonly allowed: boolean;
    readonly run: () => Promise<void>;
  } & (
    | {
        readonly confirm: ConfirmDialogRequest;
        readonly present: (
          request: ConfirmDialogRequest,
        ) => Promise<ConfirmDialogChoice>;
      }
    | {
        readonly confirm?: undefined;
        readonly present?: undefined;
      }
  ),
): Promise<void> {
  if (!args.allowed || args.busyRef.current) {
    return;
  }
  if (args.confirm !== undefined) {
    const choice = await args.present(args.confirm);
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
