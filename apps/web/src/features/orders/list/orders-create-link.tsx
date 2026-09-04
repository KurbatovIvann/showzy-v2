import { Link } from "@tanstack/react-router";

import { buttonClassName } from "../../../components/ui/button";
import { cx } from "../../../components/ui/cx";

/**
 * List-header / empty-catalog create affordance. Canvas `OrdersList`
 * paints this as a compact ink pill, not an `action` text link.
 * `hover:opacity-90` is extra because `<a>` does not match `:enabled`.
 */
export function OrdersCreateLink({
  companySlug,
  label,
  className,
}: {
  readonly companySlug: string;
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <Link
      to="/$companySlug/orders/new"
      params={{ companySlug }}
      search={(prev) => prev}
      className={cx(
        buttonClassName({ size: "compact" }),
        "hover:opacity-90",
        className,
      )}
    >
      {label}
    </Link>
  );
}
