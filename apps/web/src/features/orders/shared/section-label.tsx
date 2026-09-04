import type { ReactNode } from "react";

/** Canvas section eyebrow: 12px uppercase faint (OrdersList groups, detail/create). */
export function OrdersSectionLabel({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <h3 className="text-[12px] font-semibold uppercase tracking-wide text-faint">
      {children}
    </h3>
  );
}
