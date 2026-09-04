import { cx } from "../../../components/ui/cx";

const SEARCH_CLASS = cx(
  "w-full rounded-full bg-canvas px-3.5 py-2 text-[13px] text-ink",
  "placeholder:text-faint focus-visible:outline-hidden focus-visible:ring-2",
  "focus-visible:ring-action",
);

/** Canvas order search: pill field, 13px. Border is optional (dropdown vs pane). */
export function OrdersSearchInput({
  id,
  label,
  value,
  placeholder,
  maxLength,
  bordered = true,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly maxLength?: number;
  readonly bordered?: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={cx(SEARCH_CLASS, bordered ? "border border-line" : false)}
      />
    </>
  );
}
