import { Minus, Plus, Trash2 } from "lucide-react";

import { interpolate } from "../../../i18n/locale";
import type { OrdersCreateCopy } from "../../../i18n/orders";
import { OrderThumbnail } from "../shared/order-thumbnail";

export function OrderLineCard(props: {
  readonly productName: string;
  readonly variantName: string | null;
  readonly quantityLabel: string;
  readonly editable: boolean;
  readonly thumbnailFileId: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailFailed: boolean;
  readonly copy: OrdersCreateCopy;
  readonly onStep: (deltaUnits: number) => void;
  readonly onRemove: () => void;
}) {
  const removeLabel = interpolate(props.copy.removeLine, {
    name: props.productName,
  });

  return (
    <li className="flex items-center gap-3 py-3">
      <OrderThumbnail
        fileId={props.thumbnailFileId}
        url={props.thumbnailUrl}
        failed={props.thumbnailFailed}
        failedLabel={props.copy.thumbnailUnavailable}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">
          {props.productName}
        </span>
        {props.variantName !== null ? (
          <span className="mt-0.5 block text-[13px] text-muted">
            {props.variantName}
          </span>
        ) : null}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={props.copy.qtyDecrease}
          disabled={!props.editable}
          onClick={() => {
            props.onStep(-1);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
        >
          <Minus size={16} aria-hidden />
        </button>
        <span className="min-w-6 text-center text-[15px] font-semibold tabular-nums text-ink">
          {props.quantityLabel}
        </span>
        <button
          type="button"
          aria-label={props.copy.qtyIncrease}
          disabled={!props.editable}
          onClick={() => {
            props.onStep(1);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
        >
          <Plus size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={removeLabel}
          disabled={!props.editable}
          onClick={props.onRemove}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-danger hover:bg-canvas focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  );
}
