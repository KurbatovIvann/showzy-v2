import { cx } from "../../components/ui/cx";

export function ChannelTabs<K extends string>({
  tabs,
  selected,
  onSelect,
  disabled,
  label,
}: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled?: boolean;
  readonly label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mt-8 flex rounded-full bg-canvas p-1"
    >
      {tabs.map((tab) => {
        const isSelected = selected === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={disabled}
            onClick={() => {
              onSelect(tab.key);
            }}
            className={cx(
              "flex-1 rounded-full px-4 py-2.5 text-[15px] font-medium",
              "transition-colors duration-150 ease-soft",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-action",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
              "disabled:opacity-40",
              isSelected
                ? "bg-surface text-ink shadow-card"
                : "text-muted hover:enabled:text-ink",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
