import { Link } from "@tanstack/react-router";

import { Banner } from "../../auth/shared/banner";
import { cx } from "../../../components/ui/cx";
import { StatusPill } from "../../../components/ui/status-pill";
import { orderGroupCountLabel, type OrdersCopy } from "../../../i18n/orders";
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
  "flex w-full items-start gap-3 rounded-field px-3 py-3 text-left",
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
      <div className="shrink-0 px-4 pb-2 pt-3 sm:px-5">
        <label className="sr-only" htmlFor="orders-list-search">
          {copy.searchLabel}
        </label>
        <input
          id="orders-list-search"
          type="search"
          value={searchText}
          placeholder={copy.searchPlaceholder}
          onChange={(event) => {
            onSearchChange(event.target.value);
          }}
          className={cx(
            "w-full rounded-card border border-line bg-canvas px-3 py-2 text-[14px] text-ink",
            "placeholder:text-faint focus-visible:outline-hidden focus-visible:ring-2",
            "focus-visible:ring-action",
          )}
        />
      </div>
      <div
        role="group"
        aria-label={copy.filterStatus}
        className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-5"
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
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 sm:px-3">
        {state.kind === "loading" ? (
          <p
            aria-label={copy.loadingLabel}
            aria-live="polite"
            className="px-3 py-6 text-[14px] text-muted"
            role="status"
          >
            {copy.loadingLabel}
          </p>
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
          <div className="px-3 py-10 text-center">
            <p className="text-[15px] font-medium text-ink">
              {copy.empty.catalogTitle}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {copy.empty.catalogDescription}
            </p>
            <OrdersCreateLink
              companySlug={companySlug}
              label={copy.empty.catalogAction}
              className="mt-4"
            />
          </div>
        ) : null}
        {state.kind === "empty-filtered" ? (
          <div className="px-3 py-10 text-center">
            <p className="text-[15px] font-medium text-ink">
              {copy.empty.filteredTitle}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {copy.empty.filteredDescription}
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 text-[14px] font-medium text-action"
            >
              {copy.empty.reset}
            </button>
          </div>
        ) : null}
        {state.kind === "rows" ? (
          <ul>
            {entries.map((entry) => {
              if (entry.type === "header") {
                return (
                  <li key={entry.key} className="px-3 pb-1 pt-3">
                    <h3 className="text-[12px] font-medium text-muted">
                      {orderGroupCountLabel(copy, entry.key, entry.count)}
                    </h3>
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
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
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
