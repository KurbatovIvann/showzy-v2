import { Layers } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cx } from "../../components/ui/cx";
import { DetailStage } from "../../components/ui/detail-stage";
import { detailPaneClass, listPaneClass } from "../../components/ui/pane-class";
import { PaneHeader } from "../../components/ui/pane-header";
import { sectionTitle } from "./left-nav";
import { usePanelChrome } from "./panel-chrome-context";
import {
  isDocumentsTemplatesPath,
  isSectionDetailPath,
  listPathForPathname,
  panelSectionFromPathname,
  type PanelSectionId,
} from "./section-path";
import { usePanelChromeCopy } from "./use-panel-chrome-copy";

export function SectionWorkspace({
  section,
  children,
}: {
  readonly section: PanelSectionId;
  readonly children: ReactNode;
}) {
  const copy = usePanelChromeCopy();
  const chrome = usePanelChrome();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const detailOpen = isSectionDetailPath(pathname, chrome.companySlug);
  const phone = chrome.mode === "phone";
  const listVisible = !phone || !detailOpen;
  const detailVisible = !phone || detailOpen;

  return (
    <>
      <section
        aria-label={sectionTitle(section, copy)}
        hidden={!listVisible}
        className={listPaneClass(listVisible)}
      >
        <PaneHeader
          title={sectionTitle(section, copy)}
          menuLabel={copy.menu}
          backLabel={copy.backToList}
          onOpenNav={chrome.openNav}
          showMenu={chrome.mode === "tablet"}
          showBack={false}
        />
        {section === "documents" ? (
          <DocumentsTabs
            companySlug={chrome.companySlug}
            templates={isDocumentsTemplatesPath(pathname, chrome.companySlug)}
          />
        ) : null}
        {section === "customers" ||
        section === "customer-groups" ||
        section === "counterparties" ? (
          <CustomersTabs
            companySlug={chrome.companySlug}
            section={section}
          />
        ) : null}
        {section === "company" ? (
          <CompanyRows companySlug={chrome.companySlug} pathname={pathname} />
        ) : null}
      </section>
      <div hidden={!detailVisible} className={detailPaneClass(detailVisible)}>
        {children}
      </div>
    </>
  );
}

export function SectionDetailPlaceholder({
  section,
}: {
  readonly section: PanelSectionId;
}) {
  const copy = usePanelChromeCopy();
  const chrome = usePanelChrome();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const phone = chrome.mode === "phone";
  const detailOpen = isSectionDetailPath(pathname, chrome.companySlug);

  return (
    <DetailStage label={copy.detailLabel} className="flex h-full flex-col">
      <PaneHeader
        title={sectionTitle(section, copy)}
        menuLabel={copy.menu}
        backLabel={copy.backToList}
        onOpenNav={chrome.openNav}
        onBack={() => {
          void navigate({
            to: listPathForPathname(pathname, chrome.companySlug),
            params: { companySlug: chrome.companySlug },
          });
        }}
        showMenu={false}
        showBack={phone && detailOpen}
      />
      <div className="px-6 py-14 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-canvas">
          <Layers size={20} className="text-muted" aria-hidden />
        </span>
        <h2 className="mt-5 text-[20px] font-semibold tracking-tight text-ink">
          {copy.moduleTitle}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {copy.moduleHint}
        </p>
      </div>
    </DetailStage>
  );
}

export function SectionWorkspacePage() {
  const chrome = usePanelChrome();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = panelSectionFromPathname(pathname, chrome.companySlug);
  return (
    <SectionWorkspace section={section}>
      <SectionDetailPlaceholder section={section} />
    </SectionWorkspace>
  );
}

export function FullShellPlaceholderPage({
  companySlug,
}: {
  readonly companySlug: string;
}) {
  const copy = usePanelChromeCopy();
  const navigate = useNavigate();
  return (
    <main className="flex min-h-svh flex-col bg-canvas">
      <PaneHeader
        title={copy.templatesTab}
        menuLabel={copy.menu}
        backLabel={copy.backToList}
        onOpenNav={() => undefined}
        onBack={() => {
          void navigate({
            to: "/$companySlug/documents/templates",
            params: { companySlug },
          });
        }}
        showMenu={false}
        showBack
      />
      <DetailStage label={copy.detailLabel}>
        <div className="px-6 py-14 text-center">
          <h2 className="text-[20px] font-semibold tracking-tight text-ink">
            {copy.moduleTitle}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {copy.moduleHint}
          </p>
        </div>
      </DetailStage>
    </main>
  );
}

function DocumentsTabs({
  companySlug,
  templates,
}: {
  readonly companySlug: string;
  readonly templates: boolean;
}) {
  const copy = usePanelChromeCopy();
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-3 sm:px-5">
      <TabLink
        label={copy.documentsTab}
        selected={!templates}
        params={{ companySlug }}
        to="/$companySlug/documents"
      />
      <TabLink
        label={copy.templatesTab}
        selected={templates}
        params={{ companySlug }}
        to="/$companySlug/documents/templates"
      />
    </div>
  );
}

function CustomersTabs({
  companySlug,
  section,
}: {
  readonly companySlug: string;
  readonly section: PanelSectionId;
}) {
  const copy = usePanelChromeCopy();
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-3 sm:px-5">
      <TabLink
        label={copy.customers}
        selected={section === "customers"}
        params={{ companySlug }}
        to="/$companySlug/customers"
      />
      <TabLink
        label={copy.customerGroupsShort}
        selected={section === "customer-groups"}
        params={{ companySlug }}
        to="/$companySlug/customers/groups"
      />
      <TabLink
        label={copy.counterparties}
        selected={section === "counterparties"}
        params={{ companySlug }}
        to="/$companySlug/customers/counterparties"
      />
    </div>
  );
}

function CompanyRows({
  companySlug,
  pathname,
}: {
  readonly companySlug: string;
  readonly pathname: string;
}) {
  const copy = usePanelChromeCopy();
  const legal = pathname.includes("/company/legal");
  const team = pathname.includes("/company/team");
  const profile = !legal && !team;
  return (
    <ul className="flex-1 overflow-y-auto px-3 pb-4">
      <CompanyRow
        label={copy.companyProfile}
        selected={profile}
        params={{ companySlug }}
        to="/$companySlug/company"
      />
      <CompanyRow
        label={copy.companyLegal}
        selected={legal}
        params={{ companySlug }}
        to="/$companySlug/company/legal"
      />
      <CompanyRow
        label={copy.companyTeam}
        selected={team}
        params={{ companySlug }}
        to="/$companySlug/company/team"
      />
    </ul>
  );
}

function TabLink({
  label,
  selected,
  to,
  params,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly to:
    | "/$companySlug/documents"
    | "/$companySlug/documents/templates"
    | "/$companySlug/customers"
    | "/$companySlug/customers/groups"
    | "/$companySlug/customers/counterparties";
  readonly params: { readonly companySlug: string };
}) {
  return (
    <Link
      aria-current={selected ? "page" : undefined}
      params={params}
      to={to}
      className={cx(
        "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
        "transition-colors duration-150 ease-soft",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
        selected
          ? "bg-actionSoft text-action"
          : "border border-line text-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}

function CompanyRow({
  label,
  selected,
  to,
  params,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly to:
    | "/$companySlug/company"
    | "/$companySlug/company/legal"
    | "/$companySlug/company/team";
  readonly params: { readonly companySlug: string };
}) {
  return (
    <li>
      <Link
        aria-current={selected ? "page" : undefined}
        params={params}
        to={to}
        className={cx(
          "mb-1 flex w-full items-center gap-3 rounded-field px-3 py-3.5 text-left",
          "transition-colors duration-150 ease-soft",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
          selected ? "bg-actionSoft" : "hover:bg-canvas",
        )}
      >
        <span className="block truncate text-[15px] font-medium text-ink">
          {label}
        </span>
      </Link>
    </li>
  );
}
