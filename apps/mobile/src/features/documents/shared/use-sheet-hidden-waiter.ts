/**
 * Copied from pricing `useSheetHiddenWaiter`. Documents must not import
 * pricing list hooks.
 */
import { useRef } from "react";

import { waitForSheetHidden } from "../../../components/ui/sheet-dismiss";

export function useSheetHiddenWaiter(): {
  readonly notify: () => void;
  readonly wait: () => Promise<void>;
} {
  const waitersRef = useRef<Array<() => void>>([]);
  return {
    notify: () => {
      const waiters = waitersRef.current;
      waitersRef.current = [];
      for (const waiter of waiters) {
        waiter();
      }
    },
    wait: () =>
      waitForSheetHidden(
        new Promise<void>((resolve) => {
          waitersRef.current.push(resolve);
        }),
      ),
  };
}
