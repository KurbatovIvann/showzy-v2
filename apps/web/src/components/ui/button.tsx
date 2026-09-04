import type { ButtonHTMLAttributes } from "react";

import { cx } from "./cx";

/**
 * Panel button, ported from the web canvas markup (SHO-311, ADR-0024).
 * Primary is ink with pill radius (never action blue); the focus-visible
 * ring uses the `action` token (`web-panel-chrome.md` §Visual language).
 */
export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "compact" | "sm" | "md" | "lg";

const BASE_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "transition-opacity duration-150 ease-soft " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action " +
  "disabled:opacity-40";

/* Canvas sources: primary = detail-footer / auth CTA (`bg-ink … hover:opacity-90`),
   secondary = form-footer «Скасувати» (`border border-line text-ink`),
   danger = ConfirmDialog confirm (`bg-danger text-white`). */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:enabled:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:enabled:bg-canvas",
  danger: "bg-danger text-white hover:enabled:opacity-90",
};

/* Canvas sources: compact = list-header «+ Нове» (`px-3 py-1.5 text-[13px]`),
   sm = ConfirmDialog (`py-2.5 text-[14px]`),
   md = detail/form footers (`py-3 text-[15px]`),
   lg = auth CTA (`py-4 text-[17px]`). */
const SIZE_CLASS: Record<ButtonSize, string> = {
  compact: "px-3 py-1.5 text-[13px] focus-visible:ring-offset-2",
  sm: "px-4 py-2.5 text-[14px]",
  md: "px-5 py-3 text-[15px]",
  lg: "px-6 py-4 text-[17px]",
};

/** Shared visual classes so a `Link` can look like `Button` without a nested control. */
export function buttonClassName({
  variant = "primary",
  size = "md",
}: {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
} = {}): string {
  return cx(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size]);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClassName({ variant, size }), className)}
      {...rest}
    />
  );
}
