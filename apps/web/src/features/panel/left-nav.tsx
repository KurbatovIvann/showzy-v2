import { useState, type ReactNode } from "react";
import {
  Box,
  Building2,
  ChevronDown,
  FileText,
  MailPlus,
  ShoppingBag,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

import { cx } from "../../components/ui/cx";
import type { PanelChromeCopy } from "../../i18n/panel/chrome";
import { AccountMenu } from "./account-menu";
import { usePanelChrome } from "./panel-chrome-context";
import {
  panelSectionFromPathname,
  SECTION_LIST_PATH,
  type PanelSectionId,
} from "./section-path";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = panelSectionFromPathname(pathname, chrome.companySlug);
  const [shozikOpen, setShozikOpen] = useState(false);
  const customersExpanded =
    active === "customers" ||
    active === "customer-groups" ||
    active === "counterparties";

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
            active={active}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="documents"
            label={copy.documents}
            Icon={FileText}
            active={active}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="products"
            label={copy.products}
            Icon={Box}
            active={active}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <li>
            <Link
              aria-current={active === "customers" ? "page" : undefined}
              aria-expanded={customersExpanded}
              params={{ companySlug: chrome.companySlug }}
              to="/$companySlug/customers"
              onClick={chrome.closeNav}
              className={navRowClass(active === "customers")}
            >
              <Users
                size={19}
                aria-hidden
                className={active === "customers" ? "text-ink" : "text-faint"}
              />
              <span className="flex-1 text-left">{copy.customers}</span>
              <ChevronDown
                size={16}
                aria-hidden
                className={cx(
                  "shrink-0 text-faint transition-transform duration-150 ease-soft",
                  customersExpanded ? "rotate-180" : "",
                )}
              />
            </Link>
            {customersExpanded ? (
              <ul className="mt-1 space-y-0.5">
                <ChildRow
                  id="customer-groups"
                  label={copy.customerGroupsShort}
                  active={active}
                  companySlug={chrome.companySlug}
                  onNavigate={chrome.closeNav}
                />
                <ChildRow
                  id="counterparties"
                  label={copy.counterparties}
                  active={active}
                  companySlug={chrome.companySlug}
                  onNavigate={chrome.closeNav}
                />
              </ul>
            ) : null}
          </li>
          <NavRow
            id="invites"
            label={copy.invites}
            Icon={MailPlus}
            active={active}
            companySlug={chrome.companySlug}
            onNavigate={chrome.closeNav}
          />
          <NavRow
            id="pricing"
            label={copy.pricing}
            Icon={Tags}
            active={active}
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
            active={active}
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
  readonly active: PanelSectionId;
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

function ChildRow({
  id,
  label,
  active,
  companySlug,
  onNavigate,
}: {
  readonly id: PanelSectionId;
  readonly label: string;
  readonly active: PanelSectionId;
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
        onClick={onNavigate}
        className={cx(
          "flex w-full items-center rounded-full py-2 pl-11 pr-3 text-[14px]",
          "transition-colors duration-150 ease-soft",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
          selected
            ? "bg-canvas font-semibold text-ink"
            : "font-medium text-muted hover:bg-canvas/70 hover:text-ink",
        )}
      >
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
