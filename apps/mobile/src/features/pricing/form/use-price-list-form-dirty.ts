/**
 * Subscription-fed dirty flag (SHO-304). Compares the changed path
 * against a keyed origin map — no whole-form clone, no derived Map into
 * useState on every keystroke.
 */
import { useEffect, useRef, useState } from "react";
import type { UseFormGetValues, UseFormWatch } from "react-hook-form";

import {
  reconcilePriceListFormDirty,
  type PriceListFormDraft,
  type PriceListFormOrigin,
} from "./price-list-form-draft";

export function usePriceListFormDirty(args: {
  readonly watch: UseFormWatch<PriceListFormDraft>;
  readonly getValues: UseFormGetValues<PriceListFormDraft>;
  readonly originRef: { current: PriceListFormOrigin };
  readonly originTick: number;
}): boolean {
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const dirtyKeysRef = useRef<ReadonlySet<string>>(new Set());
  const argsRef = useRef(args);
  argsRef.current = args;

  useEffect(() => {
    const { watch, getValues, originRef } = argsRef.current;
    function apply(changedPath: string | undefined): void {
      const origin = originRef.current;
      const next = reconcilePriceListFormDirty({
        values: getValues(),
        origin,
        changedPath,
        dirtyKeys: dirtyKeysRef.current,
      });
      dirtyKeysRef.current = next.dirtyKeys;
      if (next.dirty !== dirtyRef.current) {
        dirtyRef.current = next.dirty;
        setDirty(next.dirty);
      }
    }
    dirtyKeysRef.current = new Set();
    apply(undefined);
    const subscription = watch((_values, info) => {
      apply(info.name);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [args.originTick, args.getValues, args.watch]);

  return dirty;
}
