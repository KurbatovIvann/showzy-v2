import type { ReactNode } from "react";
import { ShoppingBag } from "lucide-react";

/**
 * Canvas `EmptyBlock`: bag glyph, 16px title, 13px body, ink CTA slot.
 */
export function OrdersEmptyBlock({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas">
        <ShoppingBag size={18} className="text-muted" aria-hidden />
      </span>
      <h3 className="mt-4 text-[16px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[13px] leading-5 text-muted">{body}</p>
      {action !== undefined ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
