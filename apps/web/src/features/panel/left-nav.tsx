import { useState, type ReactNode } from "react";
import {
  Box,
  Building2,
  FileText,
  MailPlus,
  ShoppingBag,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { cx } from "../../components/ui/cx";
import type { PanelChromeCopy } from "../../i18n/panel/chrome";
import { AccountMenu } from "./account-menu";
import { usePanelChrome } from "./panel-chrome-context";
import { useResolvedPanelState } from "./panel-route-state";
import {
  SECTION_LIST_PATH,
  sidebarNavSection,
  type PanelSectionId,
} from "./panel-section";
import { ShozikDialog } from "./shozik-dialog";
import { usePanelChromeCopy } from "./use-panel-chrome-copy";

export function LeftNav({
  switcher,
  onSignOut,
  className,
}: {
  readonly switcher: ReactNode;
  readonly onSignOut: () => void;
  readonly className?: string;
}) {
  const copy = usePanelChromeCopy();
  const chrome = usePanelChrome();
  const panel = useResolvedPanelState();
  const [shozikOpen, setShozikOpen] = useState(false);
  const navActive =
    panel === undefined ? undefined : sidebarNavSection(panel.panelSection);

  return (
    <>
      <nav
        aria-label={copy.mainNav}
        className={cx(
          "flex h-full w-[min(236px,100%)] shrink-0 flex-col border-r border-line bg-surface",
          className,
        )}
      >
        {switcher}
        <div className="mx-3 h-px bg-line" />
        <ul className="mt-3 space-y-1 px-3">
          <NavRow
            id="orders"
            label={copy.orders}
            Icon={ShoppingBag}
            active={navActive}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="documents"
            label={copy.documents}
            Icon={FileText}
            active={navActive}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="products"
            label={copy.products}
            Icon={Box}
            active={navActive}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="customers"
            label={copy.customers}
            Icon={Users}
            active={navActive}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="invites"
            label={copy.invites}
            Icon={MailPlus}
            active={navActive}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="pricing"
            label={copy.pricing}
            Icon={Tags}
            active={navActive}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
        </ul>
        <div className="mx-3 my-3 h-px bg-line" />
        <ul className="px-3">
          <NavRow
            id="company"
            label={copy.company}
            Icon={Building2}
            active={navActive}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
        </ul>
        <div className="flex-1" />
        <div className="mx-3 h-px bg-line" />
        <div className="px-3 py-3">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={shozikOpen}
            onClick={() => {
              setShozikOpen(true);
            }}
            className={cx(
              "flex w-full items-center justify-center gap-2 rounded-full bg-action px-3 py-2.5",
              "text-[15px] font-semibold text-white shadow-ai",
              "transition-opacity duration-150 ease-soft hover:opacity-90",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2",
            )}
          >
            <Sparkles size={18} aria-hidden />
            {copy.aiName}
          </button>
        </div>
        <div className="mx-3 h-px bg-line" />
        <AccountMenu onSignOut={onSignOut} />
      </nav>
      {shozikOpen ? (
        <ShozikDialog
          onClose={() => {
            setShozikOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function navRowClass(selected: boolean): string {
  return cx(
    "flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-[15px]",
    "transition-colors duration-150 ease-soft",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
    selected
      ? "bg-canvas font-semibold text-ink"
      : "font-medium text-muted hover:bg-canvas/70 hover:text-ink",
  );
}

function NavRow({
  id,
  label,
  Icon,
  active,
  companySlug,
  onNavigate,
}: {
  readonly id: PanelSectionId;
  readonly label: string;
  readonly Icon: typeof Box;
  readonly active: PanelSectionId | undefined;
  readonly companySlug: string;
  readonly onNavigate: () => void;
}) {
  const selected = active === id;
  return (
    <li>
      <Link
        aria-current={selected ? "page" : undefined}
        params={{ companySlug }}
        to={SECTION_LIST_PATH[id]}
        activeOptions={{ includeSearch: false }}
        onClick={onNavigate}
        className={navRowClass(selected)}
      >
        <Icon
          size={19}
          aria-hidden
          className={selected ? "text-ink" : "text-faint"}
        />
        {label}
      </Link>
    </li>
  );
}

export function sectionTitle(
  section: PanelSectionId,
  copy: PanelChromeCopy,
): string {
  switch (section) {
    case "orders":
      return copy.orders;
    case "documents":
      return copy.documents;
    case "products":
      return copy.products;
    case "customers":
      return copy.customers;
    case "customer-groups":
      return copy.customerGroups;
    case "counterparties":
      return copy.counterparties;
    case "invites":
      return copy.invites;
    case "pricing":
      return copy.pricing;
    case "company":
      return copy.company;
  }
}
