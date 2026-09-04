import { Link } from "@tanstack/react-router";

import { Banner } from "../../auth/shared/banner";
import { Button } from "../../../components/ui/button";
import { cx } from "../../../components/ui/cx";
import { StatusPill } from "../../../components/ui/status-pill";
import { orderGroupCountLabel, type OrdersCopy } from "../../../i18n/orders";
import { OrdersEmptyBlock } from "../shared/orders-empty-block";
import { OrdersListSkeleton } from "../shared/orders-list-skeleton";
import { OrdersSearchInput } from "../shared/orders-search-input";
import { OrdersSectionLabel } from "../shared/section-label";
import {
  ORDER_LIFECYCLE_STATUSES,
  type OrderLifecycleStatus,
} from "../shared/order-status";
import { OrdersCreateLink } from "./orders-create-link";
import type { OrdersListEntry, OrdersListState } from "./orders-list.presenter";

const CHIP_BASE_CLASS = cx(
  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
  "transition-colors duration-150 ease-soft",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
);
const CHIP_ACTIVE_CLASS = "bg-actionSoft text-action";
const CHIP_INACTIVE_CLASS = "border border-line text-muted hover:text-ink";

const ROW_BASE_CLASS = cx(
  "mb-1 flex w-full items-start gap-3 rounded-field px-3 py-3 text-left",
  "transition-colors duration-150 ease-soft",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
);

export function OrdersListView({
  copy,
  companySlug,
  searchText,
  statusChip,
  state,
  entries,
  selectedOrderId,
  onSearchChange,
  onStatusChipChange,
  onRetry,
  onResetFilters,
}: {
  readonly copy: OrdersCopy;
  readonly companySlug: string;
  readonly searchText: string;
  readonly statusChip: OrderLifecycleStatus | undefined;
  readonly state: OrdersListState;
  readonly entries: readonly OrdersListEntry[];
  readonly selectedOrderId: string | undefined;
  readonly onSearchChange: (value: string) => void;
  readonly onStatusChipChange: (
    status: OrderLifecycleStatus | undefined,
  ) => void;
  readonly onRetry: () => void;
  readonly onResetFilters: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-3 sm:px-5">
        <OrdersSearchInput
          id="orders-list-search"
          label={copy.searchLabel}
          value={searchText}
          placeholder={copy.searchPlaceholder}
          onChange={onSearchChange}
        />
      </div>
      <div
        role="group"
        aria-label={copy.filterStatus}
        className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-5"
      >
        <StatusChip
          label={copy.filterAll}
          pressed={statusChip === undefined}
          onClick={() => {
            onStatusChipChange(undefined);
          }}
        />
        {ORDER_LIFECYCLE_STATUSES.map((status) => (
          <StatusChip
            key={status}
            label={copy.statuses[status]}
            pressed={statusChip === status}
            onClick={() => {
              onStatusChipChange(status);
            }}
          />
        ))}
      </div>
      {state.kind === "loading" ? (
        <OrdersListSkeleton label={copy.loadingLabel} />
      ) : null}
      {state.kind === "error" ? (
        <div className="px-3 py-6">
          <Banner message={copy.empty.errorTitle} />
          <p className="mt-2 text-center text-[14px] text-muted">
            {copy.empty.errorDescription}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mx-auto mt-3 block text-[14px] font-medium text-action"
          >
            {copy.empty.retry}
          </button>
        </div>
      ) : null}
      {state.kind === "empty-catalog" ? (
        <OrdersEmptyBlock
          title={copy.empty.catalogTitle}
          body={copy.empty.catalogDescription}
          action={
            <OrdersCreateLink
              companySlug={companySlug}
              label={copy.empty.catalogAction}
            />
          }
        />
      ) : null}
      {state.kind === "empty-filtered" ? (
        <OrdersEmptyBlock
          title={copy.empty.filteredTitle}
          body={copy.empty.filteredDescription}
          action={
            <Button type="button" size="compact" onClick={onResetFilters}>
              {copy.empty.reset}
            </Button>
          }
        />
      ) : null}
      {state.kind === "rows" ? (
        <ul className="flex-1 overflow-y-auto px-3 pb-20 md:pb-4">
          {entries.map((entry) => {
            if (entry.type === "header") {
              return (
                <li key={entry.key} className="px-3 py-2.5">
                  <OrdersSectionLabel>
                    {orderGroupCountLabel(copy, entry.key, entry.count)}
                  </OrdersSectionLabel>
                </li>
              );
            }
            const selected = entry.order.id === selectedOrderId;
            return (
              <li key={entry.order.id}>
                <Link
                  to="/$companySlug/orders/$orderId"
                  params={{
                    companySlug,
                    orderId: entry.order.id,
                  }}
                  search={(prev) => prev}
                  aria-current={selected ? "page" : undefined}
                  className={cx(
                    ROW_BASE_CLASS,
                    selected ? "bg-actionSoft" : "hover:bg-canvas",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {entry.order.customerName}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {entry.order.metaLabel}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill
                      label={entry.order.statusLabel}
                      tone={entry.order.statusTone}
                    />
                    <span className="text-[14px] font-semibold tabular-nums text-ink">
                      {entry.order.totalLabel}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function StatusChip({
  label,
  pressed,
  onClick,
}: {
  readonly label: string;
  readonly pressed: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        CHIP_BASE_CLASS,
        pressed ? CHIP_ACTIVE_CLASS : CHIP_INACTIVE_CLASS,
      )}
    >
      {label}
    </button>
  );
}
