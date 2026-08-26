/**
 * Shared confirmation prompt (native `Alert`). Prefer this over a second
 * `Sheet` whenever the user must confirm a destructive or discard action —
 * stacking RN Modals on iOS leaves a stuck overlay that eats taps.
 */
export type ConfirmDialogTone = "default" | "danger";

export type ConfirmDialogChoice = "confirm" | "cancel";

export type ConfirmDialogRequest = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly tone?: ConfirmDialogTone;
};

export function confirmDialogAlertButtons(request: ConfirmDialogRequest): {
  readonly cancel: { readonly text: string; readonly style: "cancel" };
  readonly confirm: {
    readonly text: string;
    readonly style: "default" | "destructive";
  };
} {
  const tone = request.tone ?? "default";
  return {
    cancel: { text: request.cancelLabel, style: "cancel" },
    confirm: {
      text: request.confirmLabel,
      style: tone === "danger" ? "destructive" : "default",
    },
  };
}
