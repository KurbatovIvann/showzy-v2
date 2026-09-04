import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import {
  clampLineQuantityUnits,
  digitsFromQuantityInput,
  LINE_QUANTITY_INPUT_MAX_DIGITS,
  unitsFromQuantityInput,
} from "./order-form-draft";

function shouldCommitLive(digits: string): boolean {
  return digits.length > 0 && !/^0+$/.test(digits);
}

export function OrderLineQtyControl(props: {
  readonly quantityLabel: string;
  readonly editable: boolean;
  readonly inputLabel: string;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly onCommitUnits: (units: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(props.quantityLabel);

  useEffect(() => {
    if (!focused) {
      setText(props.quantityLabel);
    }
  }, [focused, props.quantityLabel]);

  function commitUnits(units: number): void {
    const next = clampLineQuantityUnits(units);
    props.onCommitUnits(next);
    if (focused) {
      setText(String(next));
    }
  }

  function currentUnits(): number {
    return unitsFromQuantityInput(focused ? text : props.quantityLabel);
  }

  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface">
      <button
        type="button"
        aria-label={props.decreaseLabel}
        disabled={!props.editable}
        onClick={() => {
          commitUnits(currentUnits() - 1);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
      >
        <Minus size={14} aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={LINE_QUANTITY_INPUT_MAX_DIGITS}
        aria-label={props.inputLabel}
        disabled={!props.editable}
        value={focused ? text : props.quantityLabel}
        onFocus={(event) => {
          setFocused(true);
          setText(props.quantityLabel);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          const digits = digitsFromQuantityInput(event.target.value).slice(
            0,
            LINE_QUANTITY_INPUT_MAX_DIGITS,
          );
          setText(digits);
          if (shouldCommitLive(digits)) {
            props.onCommitUnits(unitsFromQuantityInput(digits));
          }
        }}
        onBlur={() => {
          const next = unitsFromQuantityInput(text);
          props.onCommitUnits(next);
          setText(String(next));
          setFocused(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-9 bg-transparent p-0 text-center text-[14px] font-semibold tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
      />
      <button
        type="button"
        aria-label={props.increaseLabel}
        disabled={!props.editable}
        onClick={() => {
          commitUnits(currentUnits() + 1);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}
