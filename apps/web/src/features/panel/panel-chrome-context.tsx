import { createContext, useContext, type ReactNode } from "react";

import type { PanelShellMode } from "./panel-shell-mode";

export type PanelChromeContextValue = {
  readonly mode: PanelShellMode;
  readonly companySlug: string;
  readonly openNav: () => void;
  readonly closeNav: () => void;
};

const PanelChromeContext = createContext<PanelChromeContextValue | null>(null);

export function PanelChromeProvider({
  value,
  children,
}: {
  readonly value: PanelChromeContextValue;
  readonly children: ReactNode;
}) {
  return (
    <PanelChromeContext.Provider value={value}>
      {children}
    </PanelChromeContext.Provider>
  );
}

export function usePanelChrome(): PanelChromeContextValue {
  const value = useContext(PanelChromeContext);
  if (value === null) {
    throw new Error("usePanelChrome must be used within PanelChrome");
  }
  return value;
}
