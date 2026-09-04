import { useEffect, useId, useRef, useState } from "react";
import { Check, MoreHorizontal, Play } from "lucide-react";

import { Banner } from "../../auth/shared/banner";
import { Button } from "../../../components/ui/button";
import { cx } from "../../../components/ui/cx";
import { DetailStage } from "../../../components/ui/detail-stage";
import { PaneHeader } from "../../../components/ui/pane-header";
import { StatusPill } from "../../../components/ui/status-pill";
import { panelChromeCopy } from "../../../i18n/panel/chrome";
import { detectLocale } from "../../../i18n/locale";
import type { OrdersCopy } from "../../../i18n/orders";
import type { OrderQueryLoadState } from "../shared/classify-order-load";
import { CustomerIdentityCard } from "../shared/customer-identity-card";
import { OrderThumbnail } from "../shared/order-thumbnail";
import { OrdersSectionLabel } from "../shared/section-label";
import type { OrderDetailViewModel } from "./order-detail.presenter";

export function OrderDetailView({
  copy,
  state,
  order,
  headerTitle,
  showBack,
  onBack,
  showConfirm,
  showStart,
  showComplete,
  showActions,
  cancelEnabled,
  confirmPending,
  startPending,
  completePending,
  cancelPending,
  statusBanner,
  onRetry,
  onConfirm,
  onStart,
  onComplete,
  onCancel,
}: {
  readonly copy: OrdersCopy;
  readonly state: OrderQueryLoadState;
  readonly order: OrderDetailViewModel | null;
  readonly headerTitle: string;
  readonly showBack: boolean;
  readonly onBack: () => void;
  readonly showConfirm: boolean;
  readonly showStart: boolean;
  readonly showComplete: boolean;
  readonly showActions: boolean;
  readonly cancelEnabled: boolean;
  readonly confirmPending: boolean;
  readonly startPending: boolean;
  readonly completePending: boolean;
  readonly cancelPending: boolean;
  readonly statusBanner: string | null;
  readonly onRetry: () => void;
  readonly onConfirm: () => void;
  readonly onStart: () => void;
  readonly onComplete: () => void;
  readonly onCancel: () => void;
}) {
  const chromeCopy = panelChromeCopy(
    detectLocale(typeof navigator === "undefined" ? "uk" : navigator.language),
  );
  const stageLabel =
    state.kind === "ready" && order !== null
      ? headerTitle
      : chromeCopy.detailLabel;
  const subtitle =
    state.kind === "ready" && order !== null ? order.customerName : undefined;
  const primaryLabel = showConfirm
    ? copy.detail.confirmLabel
    : showStart
      ? copy.detail.startLabel
      : showComplete
        ? copy.detail.completeLabel
        : null;
  const primaryPending = showConfirm
    ? confirmPending
    : showStart
      ? startPending
      : showComplete
        ? completePending
        : false;
  const onPrimary = showConfirm
    ? onConfirm
    : showStart
      ? onStart
      : showComplete
        ? onComplete
        : null;

  return (
    <DetailStage label={stageLabel} className="flex h-full flex-col">
      <PaneHeader
        title={<h2 className="text-inherit font-inherit">{headerTitle}</h2>}
        subtitle={subtitle}
        menuLabel={chromeCopy.menu}
        backLabel={chromeCopy.backToList}
        onOpenNav={() => undefined}
        onBack={onBack}
        showMenu={false}
        showBack={showBack}
        trailing={
          showActions && cancelEnabled ? (
            <CancelMenu
              label={copy.detail.actionsLabel}
              cancelLabel={copy.detail.cancelOrder}
              pending={cancelPending}
              onCancel={onCancel}
            />
          ) : null
        }
      />
      {state.kind === "loading" ? (
        <p
          aria-label={copy.detail.loadingLabel}
          aria-live="polite"
          className="px-6 py-10 text-center text-[14px] text-muted"
          role="status"
        >
          {copy.detail.loadingLabel}
        </p>
      ) : null}
      {state.kind === "error" ? (
        <div className="px-6 py-10">
          <Banner message={copy.detail.errorTitle} />
          <p className="mt-2 text-center text-[14px] text-muted">
            {copy.detail.errorDescription}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mx-auto mt-3 block text-[14px] font-medium text-action"
          >
            {copy.detail.retry}
          </button>
        </div>
      ) : null}
      {state.kind === "not-found" ? (
        <div className="px-6 py-14 text-center">
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">
            {copy.detail.notFoundTitle}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {copy.detail.notFoundDescription}
          </p>
        </div>
      ) : null}
      {state.kind === "ready" && order !== null ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <StatusPill
              label={order.statusLabel}
              tone={order.statusTone}
              size="md"
            />
            <div className="mt-5">
              <OrdersSectionLabel>
                {copy.detail.customerTitle}
              </OrdersSectionLabel>
              <div className="mt-2 rounded-card bg-canvas p-3">
                <CustomerIdentityCard
                  name={order.customerName}
                  phone={order.customerPhone}
                />
              </div>
            </div>
            <div className="mt-5">
              <OrdersSectionLabel>{copy.detail.linesTitle}</OrdersSectionLabel>
              <ul className="mt-2 space-y-1">
                {order.lines.map((line) => (
                  <li
                    key={line.itemId}
                    className="flex items-start gap-3 rounded-xl bg-canvas px-3 py-3"
                  >
                    <OrderThumbnail
                      fileId={line.thumbnailFileId}
                      url={line.thumbnailUrl}
                      failed={line.thumbnailFailed}
                      failedLabel={copy.detail.thumbnailUnavailable}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-ink">
                        {line.title}
                      </span>
                      <span className="text-[12px] text-muted">
                        {line.metaLabel}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] font-medium tabular-nums text-ink">
                      {line.grossLabel}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between px-1 py-2">
                <span className="text-[13px] text-muted">
                  {copy.detail.dueLabel}
                </span>
                <span className="text-[16px] font-semibold tabular-nums text-ink">
                  {order.dueLabel}
                </span>
              </div>
            </div>
            {order.comment !== null ? (
              <div className="mt-5">
                <OrdersSectionLabel>
                  {copy.detail.commentTitle}
                </OrdersSectionLabel>
                <p className="mt-2 rounded-card bg-canvas p-4 text-[15px] leading-6 text-ink">
                  {order.comment}
                </p>
              </div>
            ) : null}
            {statusBanner !== null ? (
              <div className="mt-4">
                <Banner message={statusBanner} />
              </div>
            ) : null}
          </div>
          {onPrimary !== null && primaryLabel !== null ? (
            <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface p-3 sm:p-4">
              <Button
                className="w-full"
                disabled={primaryPending}
                onClick={onPrimary}
              >
                {showStart ? (
                  <Play size={16} aria-hidden />
                ) : (
                  <Check size={16} aria-hidden />
                )}
                {primaryLabel}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </DetailStage>
  );
}

function CancelMenu({
  label,
  cancelLabel,
  pending,
  onCancel,
}: {
  readonly label: string;
  readonly cancelLabel: string;
  readonly pending: boolean;
  readonly onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      const node = event.target;
      if (node instanceof Node && rootRef.current?.contains(node)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className={cx(
          "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
        )}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-11 z-10 min-w-[220px] overflow-hidden rounded-card border border-line bg-surface shadow-auth"
        >
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onCancel();
            }}
            className="w-full px-4 py-2.5 text-left text-[14px] font-medium text-danger hover:bg-dangerSoft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
          >
            {cancelLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
