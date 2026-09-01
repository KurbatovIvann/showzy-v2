import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { useAuthSession } from "../../auth/session-provider";
import type { CompanyMembership } from "../companies/api/list-mine";
import { CompanySwitcher } from "../companies/scope/company-switcher";
import { useCompanyScopeCopy } from "../companies/scope/use-company-scope-copy";
import { LeftNav } from "./left-nav";
import { MobileTabBar } from "./mobile-tab-bar";
import { PanelChromeProvider } from "./panel-chrome-context";
import { usePanelShellMode } from "./use-panel-shell-mode";
import { usePanelChromeCopy } from "./use-panel-chrome-copy";

export function PanelChrome({
  companySlug,
  current,
  memberships,
  children,
}: {
  readonly companySlug: string;
  readonly current: CompanyMembership;
  readonly memberships: readonly CompanyMembership[];
  readonly children: ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const mode = usePanelShellMode(shellRef);
  const [navOpen, setNavOpen] = useState(false);
  if (mode !== "tablet" && navOpen) {
    setNavOpen(false);
  }
  const chromeCopy = usePanelChromeCopy();
  const switcherCopy = useCompanyScopeCopy();
  const auth = useAuthSession();

  const openNav = useCallback(() => {
    setNavOpen(true);
  }, []);
  const closeNav = useCallback(() => {
    setNavOpen(false);
  }, []);

  const signOut = useCallback(() => {
    void auth.signOut();
  }, [auth]);

  const value = useMemo(
    () => ({
      mode,
      companySlug,
      openNav,
      closeNav,
    }),
    [mode, companySlug, openNav, closeNav],
  );

  const switcher = (
    <CompanySwitcher
      copy={switcherCopy}
      current={current}
      memberships={memberships}
      roles={chromeCopy.roles}
    />
  );

  return (
    <PanelChromeProvider value={value}>
      <div
        ref={shellRef}
        data-shell={mode}
        className="panel-shell relative flex h-svh min-h-0 w-full flex-col overflow-hidden bg-canvas"
      >
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {mode === "desktop" ? (
            <LeftNav switcher={switcher} onSignOut={signOut} />
          ) : null}

          {mode === "tablet" && navOpen ? (
            <div className="nav-drawer absolute inset-0 z-40">
              <button
                type="button"
                aria-label={chromeCopy.closeMenu}
                className="absolute inset-0 bg-ink/25"
                onClick={closeNav}
              />
              <LeftNav
                className="relative z-10 h-full shadow-auth"
                switcher={switcher}
                onSignOut={signOut}
              />
            </div>
          ) : null}

          {children}
        </div>

        {mode === "phone" ? <MobileTabBar onSignOut={signOut} /> : null}
      </div>
    </PanelChromeProvider>
  );
}
