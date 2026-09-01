import { useId } from "react";

import { cx } from "../../components/ui/cx";

export function ChannelTabs<K extends string>({
  tabs,
  selected,
  onSelect,
  disabled,
  label,
  className,
}: {
  readonly tabs: ReadonlyArray<{ readonly key: K; readonly label: string }>;
  readonly selected: K;
  readonly onSelect: (key: K) => void;
  readonly disabled?: boolean;
  readonly label: string;
  /** OTP keeps `mt-8`. Pass `""` when a parent already spaces the control. */
  readonly className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("flex rounded-full bg-canvas p-1", className ?? "mt-8")}
    >
      {tabs.map((tab) => {
        const isSelected = selected === tab.key;
        return (
          <label
            key={tab.key}
            className={cx(
              "flex-1 cursor-pointer rounded-full px-4 py-2.5 text-center",
              "text-[15px] font-medium",
              "transition-colors duration-150 ease-soft",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action",
              "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas",
              disabled === true ? "cursor-not-allowed opacity-40" : false,
              isSelected ? "bg-surface text-ink shadow-card" : "text-muted",
              disabled !== true && !isSelected ? "hover:text-ink" : false,
            )}
          >
            <input
              type="radio"
              name={name}
              value={tab.key}
              checked={isSelected}
              disabled={disabled}
              onChange={() => {
                onSelect(tab.key);
              }}
              className="sr-only"
            />
            {tab.label}
          </label>
        );
      })}
    </div>
  );
}
