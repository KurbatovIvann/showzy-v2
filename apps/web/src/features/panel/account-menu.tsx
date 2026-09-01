import { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  CircleQuestionMark,
  Keyboard,
  LogOut,
  User,
} from "lucide-react";

import { useAuthSession } from "../../auth/session-provider";
import { cx } from "../../components/ui/cx";
import { accountDisplayLabel, accountInitials } from "./account-label";
import { MockAccountPage } from "./shozik-dialog";
import { usePanelChromeCopy } from "./use-panel-chrome-copy";

type ThemeId = "light" | "system" | "dark";
type MockPageId = "account" | "alerts" | "keys" | "help";

/**
 * Desktop footer account **dropdown**. Вийти lives inside the menu — never
 * a one-click control (`web-panel-chrome.md` Pattern lock). Hand-rolled
 * (T3 primitives, no new Radix dependency).
 */
export function AccountMenu({ onSignOut }: { readonly onSignOut: () => void }) {
  const copy = usePanelChromeCopy();
  const auth = useAuthSession();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("light");
  const [mockPage, setMockPage] = useState<MockPageId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const label = accountDisplayLabel(auth.session, copy.accountFallback);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      const node = event.target;
      if (node instanceof Node && rootRef.current?.contains(node)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const openMock = (id: MockPageId) => {
    setOpen(false);
    setMockPage(id);
  };

  const themes: ReadonlyArray<{ id: ThemeId; label: string }> = [
    { id: "light", label: copy.themeLight },
    { id: "system", label: copy.themeSystem },
    { id: "dark", label: copy.themeDark },
  ];

  return (
    <div ref={rootRef} className="relative p-2">
      <button
        type="button"
        aria-label={copy.accountMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className={cx(
          "flex w-full items-center gap-3 rounded-card px-2 py-2 text-left",
          "transition-colors duration-150 ease-soft hover:bg-canvas",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-[13px] font-semibold text-muted">
          {accountInitials(label)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">
            {label}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cx(
            "shrink-0 text-faint transition-transform duration-150 ease-soft",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={copy.accountMenu}
          className="absolute bottom-[calc(100%-4px)] left-2 right-2 z-20 overflow-hidden rounded-card border border-line bg-surface shadow-auth"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
              {copy.theme}
            </p>
            <div
              className="mt-2 flex rounded-full bg-canvas p-0.5"
              role="group"
              aria-label={`${copy.theme} (${copy.mockEyebrow})`}
            >
              {themes.map((item) => {
                const selected = theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      setTheme(item.id);
                    }}
                    className={cx(
                      "flex-1 rounded-full px-2 py-1.5 text-[12px] font-medium",
                      "transition-colors duration-150 ease-soft",
                      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
                      selected
                        ? "bg-surface text-ink shadow-card"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-faint">{copy.themeMock}</p>
          </div>

          <ul className="py-1">
            <MenuItem
              icon={User}
              label={copy.myAccount}
              onSelect={() => {
                openMock("account");
              }}
            />
            <MenuItem
              icon={Bell}
              label={copy.notifications}
              onSelect={() => {
                openMock("alerts");
              }}
            />
            <MenuItem
              icon={Keyboard}
              label={copy.keyboard}
              onSelect={() => {
                openMock("keys");
              }}
            />
            <MenuItem
              icon={CircleQuestionMark}
              label={copy.help}
              onSelect={() => {
                openMock("help");
              }}
            />
          </ul>

          <div className="border-t border-line p-1">
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              className={cx(
                "flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-[14px] font-medium text-danger",
                "transition-colors duration-150 ease-soft hover:bg-dangerSoft",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action",
              )}
            >
              <LogOut size={16} aria-hidden />
              {copy.signOut}
            </button>
          </div>
        </div>
      ) : null}

      {mockPage === "account" ? (
        <MockAccountPage
          title={copy.myAccount}
          body={copy.myAccountBody}
          onClose={() => {
            setMockPage(null);
          }}
        />
      ) : null}
      {mockPage === "alerts" ? (
        <MockAccountPage
          title={copy.notifications}
          body={copy.notificationsBody}
          onClose={() => {
            setMockPage(null);
          }}
        />
      ) : null}
      {mockPage === "keys" ? (
        <MockAccountPage
          title={copy.keyboard}
          body={copy.keyboardBody}
          onClose={() => {
            setMockPage(null);
          }}
        />
      ) : null}
      {mockPage === "help" ? (
        <MockAccountPage
          title={copy.help}
          body={copy.helpBody}
          onClose={() => {
            setMockPage(null);
          }}
        />
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
}: {
  readonly icon: typeof User;
  readonly label: string;
  readonly onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onSelect}
        className={cx(
          "flex w-full items-center gap-2.5 px-3 py-2 text-[14px] font-medium text-ink",
          "transition-colors duration-150 ease-soft hover:bg-canvas",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action",
        )}
      >
        <Icon size={16} className="text-muted" aria-hidden />
        {label}
      </button>
    </li>
  );
}
