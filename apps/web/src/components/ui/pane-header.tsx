import type { ReactNode } from "react";
import { ChevronLeft, Menu } from "lucide-react";

import { cx } from "./cx";

/**
 * List/detail pane header from the web canvas `PaneHeader` (SHO-314).
 * Hamburger is tablet-only; back is phone detail. Callers pass the
 * visibility flags from shell-width mode — CSS is not the source of
 * truth in jsdom tests.
 */
export function PaneHeader({
  title,
  subtitle,
  trailing,
  menuLabel,
  backLabel,
  onOpenNav,
  onBack,
  showMenu,
  showBack,
}: {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly trailing?: ReactNode;
  readonly menuLabel: string;
  readonly backLabel: string;
  readonly onOpenNav: () => void;
  readonly onBack?: () => void;
  readonly showMenu: boolean;
  readonly showBack: boolean;
}) {
  return (
    <div className="flex items-start gap-1 border-b border-line px-2 py-2.5 sm:px-3">
      {showMenu ? (
        <button
          type="button"
          aria-label={menuLabel}
          onClick={onOpenNav}
          className={cx(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink",
            "hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
          )}
        >
          <Menu size={20} aria-hidden />
        </button>
      ) : null}
      {showBack && onBack ? (
        <button
          type="button"
          aria-label={backLabel}
          onClick={onBack}
          className={cx(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink",
            "hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
          )}
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
      ) : null}
      <div className="min-w-0 flex-1 px-1 pt-1">
        <div className="text-[16px] font-semibold tracking-tight text-ink sm:text-[17px]">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0 pt-0.5">{trailing}</div> : null}
    </div>
  );
}
