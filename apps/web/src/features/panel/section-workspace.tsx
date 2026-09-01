import { Layers } from "lucide-react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { cx } from "../../components/ui/cx";
import { DetailStage } from "../../components/ui/detail-stage";
import { detailPaneClass, listPaneClass } from "../../components/ui/pane-class";
import { PaneHeader } from "../../components/ui/pane-header";
import { sectionTitle } from "./left-nav";
import { usePanelChrome } from "./panel-chrome-context";
import { useRequiredPanelState, type PanelPaneMode } from "./panel-route-state";
import type { CompanySlugPath, PanelSectionId } from "./panel-section";
import { usePanelChromeCopy } from "./use-panel-chrome-copy";

const TAB_BASE_CLASS = cx(
  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium",
  "transition-colors duration-150 ease-soft",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
);
const TAB_ACTIVE_CLASS = "bg-actionSoft text-action";
const TAB_INACTIVE_CLASS = "border border-line text-muted hover:text-ink";

const COMPANY_ROW_BASE_CLASS = cx(
  "mb-1 flex w-full items-center gap-3 rounded-field px-3 py-3.5 text-left",
  "transition-colors duration-150 ease-soft",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
);
const COMPANY_ROW_ACTIVE_CLASS = "bg-actionSoft";
const COMPANY_ROW_INACTIVE_CLASS = "hover:bg-canvas";

const TAB_ACTIVE_PROPS = {
  className: TAB_ACTIVE_CLASS,
  "aria-current": "page" as const,
};
const TAB_INACTIVE_PROPS = { className: TAB_INACTIVE_CLASS };
const COMPANY_ROW_ACTIVE_PROPS = {
  className: COMPANY_ROW_ACTIVE_CLASS,
  "aria-current": "page" as const,
};
const COMPANY_ROW_INACTIVE_PROPS = { className: COMPANY_ROW_INACTIVE_CLASS };

export function SectionWorkspace({
  section,
  pane,
  children,
}: {
  readonly section: PanelSectionId;
  readonly pane: PanelPaneMode;
  readonly children: ReactNode;
}) {
  const copy = usePanelChromeCopy();
  const chrome = usePanelChrome();
  const phone = chrome.mode === "phone";
  const listVisible = !phone || pane === "list";
  const detailVisible = !phone || pane === "detail";

  return (
    <>
      <section
        aria-label={sectionTitle(section, copy)}
        hidden={!listVisible}
        className={listPaneClass()}
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
          <DocumentsTabs companySlug={chrome.companySlug} />
        ) : null}
        {section === "customers" ||
        section === "customer-groups" ||
        section === "counterparties" ? (
          <CustomersTabs companySlug={chrome.companySlug} />
        ) : null}
        {section === "company" ? (
          <CompanyRows companySlug={chrome.companySlug} />
        ) : null}
      </section>
      <div hidden={!detailVisible} className={detailPaneClass()}>
        {children}
      </div>
    </>
  );
}

export function SectionDetailPlaceholder({
  section,
  listTo,
  pane,
}: {
  readonly section: PanelSectionId;
  readonly listTo: CompanySlugPath;
  readonly pane: PanelPaneMode;
}) {
  const copy = usePanelChromeCopy();
  const chrome = usePanelChrome();
  const navigate = useNavigate();
  const phone = chrome.mode === "phone";

  return (
    <DetailStage label={copy.detailLabel} className="flex h-full flex-col">
      <PaneHeader
        title={sectionTitle(section, copy)}
        menuLabel={copy.menu}
        backLabel={copy.backToList}
        onOpenNav={chrome.openNav}
        onBack={() => {
          void navigate({
            to: listTo,
            params: { companySlug: chrome.companySlug },
          });
        }}
        showMenu={false}
        showBack={phone && pane === "detail"}
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
  const panel = useRequiredPanelState();
  return (
    <SectionWorkspace section={panel.panelSection} pane={panel.pane}>
      <SectionDetailPlaceholder
        section={panel.panelSection}
        listTo={panel.listTo}
        pane={panel.pane}
      />
    </SectionWorkspace>
  );
}

/** Section parent: list pane stays mounted; children fill the detail pane. */
export function SectionWorkspaceLayout() {
  const panel = useRequiredPanelState();
  return (
    <SectionWorkspace section={panel.panelSection} pane={panel.pane}>
      <Outlet />
    </SectionWorkspace>
  );
}

/** Exact index / detail / create / edit leaf inside a section layout. */
export function SectionDetailRoutePage() {
  const panel = useRequiredPanelState();
  return (
    <SectionDetailPlaceholder
      section={panel.panelSection}
      listTo={panel.listTo}
      pane={panel.pane}
    />
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

function DocumentsTabs({ companySlug }: { readonly companySlug: string }) {
  const copy = usePanelChromeCopy();
  const { listTo } = useRequiredPanelState();
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-3 sm:px-5">
      <TabLink
        label={copy.documentsTab}
        params={{ companySlug }}
        current={listTo === "/$companySlug/documents"}
        to="/$companySlug/documents"
      />
      <TabLink
        label={copy.templatesTab}
        params={{ companySlug }}
        current={listTo === "/$companySlug/documents/templates"}
        to="/$companySlug/documents/templates"
      />
    </div>
  );
}

function CustomersTabs({ companySlug }: { readonly companySlug: string }) {
  const copy = usePanelChromeCopy();
  const { listTo } = useRequiredPanelState();
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-3 sm:px-5">
      <TabLink
        label={copy.customers}
        params={{ companySlug }}
        current={listTo === "/$companySlug/customers"}
        to="/$companySlug/customers"
      />
      <TabLink
        label={copy.customerGroupsShort}
        params={{ companySlug }}
        current={listTo === "/$companySlug/customers/groups"}
        to="/$companySlug/customers/groups"
      />
      <TabLink
        label={copy.counterparties}
        params={{ companySlug }}
        current={listTo === "/$companySlug/customers/counterparties"}
        to="/$companySlug/customers/counterparties"
      />
    </div>
  );
}

function CompanyRows({ companySlug }: { readonly companySlug: string }) {
  const copy = usePanelChromeCopy();
  return (
    <ul className="flex-1 overflow-y-auto px-3 pb-4">
      <CompanyRow
        label={copy.companyProfile}
        params={{ companySlug }}
        to="/$companySlug/company"
      />
      <CompanyRow
        label={copy.companyLegal}
        params={{ companySlug }}
        to="/$companySlug/company/legal"
      />
      <CompanyRow
        label={copy.companyTeam}
        params={{ companySlug }}
        to="/$companySlug/company/team"
      />
    </ul>
  );
}

function TabLink({
  label,
  to,
  params,
  current,
}: {
  readonly label: string;
  readonly current: boolean;
  readonly to:
    | "/$companySlug/documents"
    | "/$companySlug/documents/templates"
    | "/$companySlug/customers"
    | "/$companySlug/customers/groups"
    | "/$companySlug/customers/counterparties";
  readonly params: { readonly companySlug: string };
}) {
  // Current tab is `listTo === to` from matched staticData (document
  // detail keeps issued `listTo`; templates layout overrides it). The
  // current tab keeps default fuzzy Link matching so its own records
  // stay current. Sibling trees pass `exact` so a parent `to` cannot
  // stay active on templates / groups / counterparties.
  return (
    <Link
      params={params}
      to={to}
      activeOptions={
        current
          ? { includeSearch: false }
          : { exact: true, includeSearch: false }
      }
      activeProps={TAB_ACTIVE_PROPS}
      inactiveProps={TAB_INACTIVE_PROPS}
      className={TAB_BASE_CLASS}
    >
      {label}
    </Link>
  );
}

function CompanyRow({
  label,
  to,
  params,
}: {
  readonly label: string;
  readonly to:
    | "/$companySlug/company"
    | "/$companySlug/company/legal"
    | "/$companySlug/company/team";
  readonly params: { readonly companySlug: string };
}) {
  return (
    <li>
      <Link
        params={params}
        to={to}
        activeOptions={{ exact: true, includeSearch: false }}
        activeProps={COMPANY_ROW_ACTIVE_PROPS}
        inactiveProps={COMPANY_ROW_INACTIVE_PROPS}
        className={COMPANY_ROW_BASE_CLASS}
      >
        <span className="block truncate text-[15px] font-medium text-ink">
          {label}
        </span>
      </Link>
    </li>
  );
}
