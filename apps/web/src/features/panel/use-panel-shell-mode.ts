import { useLayoutEffect, useState, type RefObject } from "react";

import {
  panelShellModeFromWidth,
  type PanelShellMode,
} from "./panel-shell-mode";

/**
 * Observe the panel shell element. Unmeasured width (0) keeps the previous
 * mode — default `desktop` so jsdom / first paint still expose the left nav
 * (T5 heading + switcher assertions).
 */
export function usePanelShellMode(
  ref: RefObject<HTMLElement | null>,
): PanelShellMode {
  const [mode, setMode] = useState<PanelShellMode>("desktop");

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }
    const sync = () => {
      const next = panelShellModeFromWidth(node.clientWidth);
      if (next === null) {
        return;
      }
      setMode((current) => (current === next ? current : next));
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return mode;
}
