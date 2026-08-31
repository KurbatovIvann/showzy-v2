import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Detail-pane stage, ported from the web canvas `DetailStage` (SHO-311).
 * Scrolls its content and centers it in the detail card (see
 * `detail-stage.css`). `overlay` replaces the card content for blocking
 * states (dialogs render over the stage in feature code). Booleans are
 * treated as absent so the idiomatic `condition && <Overlay />` pattern
 * never blanks the pane.
 */
export function DetailStage({
  label,
  className,
  children,
  overlay,
}: {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
  readonly overlay?: ReactNode;
}) {
  const showOverlay = overlay != null && typeof overlay !== "boolean";
  return (
    <section
      aria-label={label}
      className={cx("relative h-full min-h-0", className)}
    >
      <div className="h-full min-h-0 flex-1 overflow-y-auto">
        <div className="detail-stage-inner">
          <div className="detail-card relative flex min-h-full flex-col">
            {showOverlay ? overlay : children}
          </div>
        </div>
      </div>
    </section>
  );
}
