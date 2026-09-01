import { useState } from "react";
import {
  Box,
  Building2,
  Ellipsis,
  FileText,
  Landmark,
  Layers,
  LogOut,
  MailPlus,
  ShoppingBag,
  Sparkles,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { cx } from "../../components/ui/cx";
import { usePanelChrome } from "./panel-chrome-context";
import {
  panelSectionFromPathname,
  SECTION_LIST_PATH,
  type PanelSectionId,
} from "./section-path";
import { ShozikDialog } from "./shozik-dialog";
import { usePanelChromeCopy } from "./use-panel-chrome-copy";

type TabIcon = typeof Box;

type TabItem = {
  readonly id: PanelSectionId;
  readonly label: string;
  readonly Icon: TabIcon;
};

/**
 * Phone bottom tabs (Sophie pattern). No Більше in the desktop sidebar.
 */
export function MobileTabBar({
  onSignOut,
}: {
  readonly onSignOut: () => void;
}) {
  const copy = usePanelChromeCopy();
  const chrome = usePanelChrome();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = panelSectionFromPathname(pathname, chrome.companySlug);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shozikOpen, setShozikOpen] = useState(false);

  const tabs: readonly TabItem[] = [
    { id: "orders", label: copy.orders, Icon: ShoppingBag },
    { id: "products", label: copy.products, Icon: Box },
    { id: "customers", label: copy.customers, Icon: Users },
    { id: "pricing", label: copy.pricingShort, Icon: Tags },
  ];

  const moreGroups: ReadonlyArray<{
    readonly title: string;
    readonly items: readonly TabItem[];
  }> = [
    {
      title: copy.groupOperations,
      items: [{ id: "documents", label: copy.documents, Icon: FileText }],
    },
    {
      title: copy.groupCustomers,
      items: [
        {
          id: "customer-groups",
          label: copy.customerGroups,
          Icon: Layers,
        },
        {
          id: "counterparties",
          label: copy.counterparties,
          Icon: Landmark,
        },
        { id: "invites", label: copy.invites, Icon: MailPlus },
      ],
    },
    {
      title: copy.groupSettings,
      items: [{ id: "company", label: copy.company, Icon: Building2 }],
    },
  ];

  const moreActive = moreGroups.some((group) =>
    group.items.some((item) => item.id === active),
  );

  const go = (id: PanelSectionId) => {
    setMoreOpen(false);
    void navigate({
      to: SECTION_LIST_PATH[id],
      params: { companySlug: chrome.companySlug },
    });
  };

  return (
    <div className="tab-bar relative shrink-0">
      {moreOpen ? (
        <button
          type="button"
          aria-label={copy.closeMore}
          className="absolute inset-0 z-20 bg-ink/20"
          onClick={() => {
            setMoreOpen(false);
          }}
        />
      ) : null}

      <div className="relative z-30 border-t border-line bg-surface">
        {moreOpen ? (
          <div className="absolute bottom-full left-0 right-0 rounded-t-panel border-t border-line bg-surface p-2 shadow-auth">
            {moreGroups.map((group) => (
              <div key={group.title}>
                <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <MoreRow
                    key={item.id}
                    label={item.label}
                    Icon={item.Icon}
                    selected={active === item.id}
                    onClick={() => {
                      go(item.id);
                    }}
                  />
                ))}
              </div>
            ))}
            <div className="mx-2 my-1 h-px bg-line" />
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setShozikOpen(true);
              }}
              className={cx(
                "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-semibold text-action",
                "hover:bg-actionSoft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
              )}
            >
              <Sparkles size={20} aria-hidden />
              {copy.aiName}
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onSignOut();
              }}
              className={cx(
                "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-danger",
                "hover:bg-dangerSoft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
              )}
            >
              <LogOut size={20} aria-hidden />
              {copy.signOut}
            </button>
          </div>
        ) : null}

        <nav aria-label={copy.mobileNav} className="flex h-16 items-stretch justify-around px-1">
          {tabs.map((item) => {
            const selected = active === item.id;
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => {
                  go(item.id);
                }}
                className={cx(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1",
                  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                  selected ? "text-ink" : "text-faint",
                )}
              >
                <Icon size={20} aria-hidden />
                <span className="max-w-full truncate text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-current={moreActive ? "page" : undefined}
            onClick={() => {
              setMoreOpen((prev) => !prev);
            }}
            className={cx(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
              moreOpen || moreActive ? "text-ink" : "text-faint",
            )}
          >
            {moreOpen ? (
              <X size={20} aria-hidden />
            ) : (
              <Ellipsis size={20} aria-hidden />
            )}
            <span className="text-[10px] font-medium leading-none">
              {copy.more}
            </span>
          </button>
        </nav>
      </div>

      {shozikOpen ? (
        <ShozikDialog
          onClose={() => {
            setShozikOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MoreRow({
  label,
  Icon,
  selected,
  onClick,
}: {
  readonly label: string;
  readonly Icon: TabIcon;
  readonly selected: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
        selected
          ? "bg-canvas text-ink"
          : "text-muted hover:bg-canvas hover:text-ink",
      )}
    >
      <Icon
        size={20}
        aria-hidden
        className={selected ? "text-ink" : "text-faint"}
      />
      {label}
    </button>
  );
}
