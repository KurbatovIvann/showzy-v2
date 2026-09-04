import type { ReactNode } from "react";
import { Phone, User } from "lucide-react";

import { cx } from "../../../components/ui/cx";

/**
 * Canvas customer identity: actionSoft avatar, name, optional phone.
 * Used on detail and as the create-picker trigger/row.
 */
export function CustomerIdentityCard({
  name,
  phone,
  placeholder,
  size = "md",
  trailing,
}: {
  readonly name: string | null;
  readonly phone: string | null;
  readonly placeholder?: string;
  readonly size?: "sm" | "md";
  readonly trailing?: ReactNode;
}) {
  const compact = size === "sm";
  const avatarClass = compact
    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-actionSoft"
    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-actionSoft";
  const iconSize = compact ? 16 : 18;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className={avatarClass}>
        <User size={iconSize} className="text-muted" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        {name !== null && name.length > 0 ? (
          <>
            <span
              className={cx(
                "block truncate text-ink",
                compact
                  ? "text-[14px] font-medium"
                  : "text-[15px] font-semibold",
              )}
            >
              {name}
            </span>
            {phone !== null && phone.length > 0 ? (
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                <Phone size={13} className="text-faint" aria-hidden />
                {phone}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-[15px] text-muted">{placeholder}</span>
        )}
      </span>
      {trailing}
    </span>
  );
}
