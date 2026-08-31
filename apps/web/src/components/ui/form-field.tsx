import type { ReactNode } from "react";

import { cx } from "./cx";

/**
 * Form field wrappers, ported from the web canvas `FormField.tsx`
 * (SHO-311, ADR-0024): muted 13px label, canvas-filled control with the
 * card radius, danger border + message on error, faint hint otherwise.
 * The focus-visible ring uses the `action` token (visual-language lock).
 */
type FieldShellProps = {
  readonly id: string;
  readonly label: string;
  readonly error?: string | null | undefined;
  readonly hint?: string | undefined;
  readonly children: ReactNode;
};

function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div>
      <label className="block text-[13px] text-muted" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-[12px] text-danger">{error}</p> : null}
      {!error && hint ? (
        <p className="mt-1.5 text-[12px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  "mt-1 w-full rounded-card border bg-canvas px-3 py-2.5 text-[15px] text-ink " +
  "placeholder:text-faint focus-visible:outline-hidden focus-visible:ring-2 " +
  "focus-visible:ring-action";

export function InputField({
  id,
  label,
  value,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
  error,
  hint,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly type?: string;
  readonly inputMode?: "text" | "tel" | "email" | "numeric";
  readonly maxLength?: number;
  readonly error?: string | null | undefined;
  readonly hint?: string | undefined;
  readonly onChange: (value: string) => void;
}) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={cx(CONTROL_CLASS, error ? "border-danger" : "border-line")}
      />
    </FieldShell>
  );
}

export function TextareaField({
  id,
  label,
  value,
  placeholder,
  rows = 4,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly rows?: number;
  readonly onChange: (value: string) => void;
}) {
  return (
    <FieldShell id={id} label={label}>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={cx("resize-none border-line leading-6", CONTROL_CLASS)}
      />
    </FieldShell>
  );
}
