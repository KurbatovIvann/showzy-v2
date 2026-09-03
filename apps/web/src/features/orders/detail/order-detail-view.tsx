import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal, Phone } from "lucide-react";

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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center gap-2">
              <StatusPill label={order.statusLabel} tone={order.statusTone} />
            </div>
            {order.customerPhone !== null ? (
              <p className="mt-4 flex items-center gap-2 text-[15px] text-ink">
                {order.showPhoneIcon ? (
                  <Phone size={16} className="text-muted" aria-hidden />
                ) : null}
                <span>{order.customerPhone}</span>
              </p>
            ) : null}
            <h3 className="mt-6 text-[13px] font-medium text-muted">
              {copy.detail.linesTitle}
            </h3>
            <ul className="mt-2 divide-y divide-line">
              {order.lines.map((line) => (
                <li key={line.itemId} className="flex items-start gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">
                      {line.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {line.metaLabel}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">
                    {line.grossLabel}
                  </span>
                </li>
              ))}
            </ul>
            {order.comment !== null ? (
              <div className="mt-5">
                <h3 className="text-[13px] font-medium text-muted">
                  {copy.detail.commentTitle}
                </h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">
                  {order.comment}
                </p>
              </div>
            ) : null}
            <div className="mt-6 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-muted">
                {copy.detail.dueLabel}
              </span>
              <span className="text-[18px] font-semibold tabular-nums text-ink">
                {order.dueLabel}
              </span>
            </div>
            {statusBanner !== null ? (
              <div className="mt-4">
                <Banner message={statusBanner} />
              </div>
            ) : null}
          </div>
          {onPrimary !== null && primaryLabel !== null ? (
            <div className="sticky bottom-0 border-t border-line bg-surface px-6 py-4">
              <Button
                className="w-full"
                disabled={primaryPending}
                onClick={onPrimary}
              >
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
          "mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-ink",
          "hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
        )}
      >
        <MoreHorizontal size={20} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-40 rounded-card border border-line bg-surface py-1 shadow-card"
        >
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onCancel();
            }}
            className="block w-full px-3 py-2 text-left text-[14px] font-medium text-danger hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action"
          >
            {cancelLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
