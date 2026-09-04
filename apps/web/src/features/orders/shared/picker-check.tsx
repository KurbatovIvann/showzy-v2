import { Check } from "lucide-react";

import { cx } from "../../../components/ui/cx";

/** Canvas product-picker check circle. */
export function PickerCheckCircle({ checked }: { readonly checked: boolean }) {
  return (
    <span
      className={cx(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        checked ? "bg-ink text-white" : "border border-line bg-surface",
      )}
    >
      {checked ? <Check size={14} aria-hidden /> : null}
    </span>
  );
}
