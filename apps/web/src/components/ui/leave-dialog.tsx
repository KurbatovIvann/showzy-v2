import { useEffect } from "react";

import { Button } from "./button";

/**
 * Dirty-form leave confirm. Canvas LeaveDialog intent (SHO-379): title,
 * stay vs leave, Escape stays. Domain copy is passed in — this primitive
 * has no product strings.
 */
export function LeaveDialog({
  open,
  title,
  description,
  stayLabel,
  leaveLabel,
  onStay,
  onLeave,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly stayLabel: string;
  readonly leaveLabel: string;
  readonly onStay: () => void;
  readonly onLeave: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onStay();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onStay]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={onStay}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        className="relative w-full max-w-[380px] rounded-panel bg-surface p-6 shadow-auth"
      >
        <h2
          id="leave-dialog-title"
          className="text-[20px] font-semibold text-ink"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-[15px] leading-6 text-muted">{description}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" autoFocus onClick={onStay}>
            {stayLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={onLeave}>
            {leaveLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
