import type { HTMLAttributes } from "react";

import { cx } from "./cx";

/**
 * Surface card wrapper — the canvas section card chrome (SHO-311):
 * 22px radius, hairline border, surface fill, soft shadow. Padding stays
 * with the caller (the canvas varies p-3…p-5 per surface).
 */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-card border border-line bg-surface shadow-card",
        className,
      )}
      {...rest}
    />
  );
}
