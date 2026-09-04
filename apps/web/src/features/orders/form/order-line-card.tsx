import { Trash2 } from "lucide-react";

import { interpolate } from "../../../i18n/locale";
import type { OrdersCreateCopy } from "../../../i18n/orders";
import { OrderThumbnail } from "../shared/order-thumbnail";
import { OrderLineQtyControl } from "./order-line-qty-control";

export function OrderLineCard(props: {
  readonly productName: string;
  readonly variantName: string | null;
  readonly quantityLabel: string;
  readonly editable: boolean;
  readonly thumbnailFileId: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailFailed: boolean;
  readonly copy: OrdersCreateCopy;
  readonly onCommitUnits: (units: number) => void;
  readonly onRemove: () => void;
}) {
  const removeLabel = interpolate(props.copy.removeLine, {
    name: props.productName,
  });
  const qtyInputLabel = interpolate(props.copy.qtyInput, {
    name: props.productName,
  });

  return (
    <li className="flex items-center gap-3 rounded-card bg-canvas p-3">
      <OrderThumbnail
        fileId={props.thumbnailFileId}
        url={props.thumbnailUrl}
        failed={props.thumbnailFailed}
        failedLabel={props.copy.thumbnailUnavailable}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">
          {props.productName}
        </span>
        {props.variantName !== null ? (
          <span className="mt-0.5 block text-[13px] text-muted">
            {props.variantName}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={removeLabel}
          disabled={!props.editable}
          onClick={props.onRemove}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-dangerSoft px-2.5 py-1 text-[13px] font-semibold text-danger hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
        >
          <Trash2 size={14} aria-hidden />
          {props.copy.removeVisible}
        </button>
      </span>
      <OrderLineQtyControl
        quantityLabel={props.quantityLabel}
        editable={props.editable}
        inputLabel={qtyInputLabel}
        decreaseLabel={props.copy.qtyDecrease}
        increaseLabel={props.copy.qtyIncrease}
        onCommitUnits={props.onCommitUnits}
      />
    </li>
  );
}
