import { cx } from "./cx";

/**
 * Soft-tone status capsule, ported from the web canvas `StatusPill`
 * (SHO-311, ADR-0024). Status is never color-only — the label is required.
 * Feature code maps domain statuses onto tones (e.g. orders:
 * new → action, confirmed → focus, in_progress → attention,
 * done → success, canceled → danger — `web-panel-chrome.md` §Order statuses).
 */
export type StatusPillTone =
  | "action"
  | "queued"
  | "attention"
  | "success"
  | "danger"
  | "neutral"
  | "focus";

export type StatusPillSize = "sm" | "md";

const TONE_CLASS: Record<StatusPillTone, string> = {
  action: "bg-actionSoft text-action",
  queued: "border border-line bg-canvas text-ink",
  attention: "bg-attentionSoft text-attention",
  success: "bg-successSoft text-success",
  danger: "bg-dangerSoft text-danger",
  neutral: "border border-line bg-canvas text-muted",
  focus: "bg-focusSoft text-focus",
};

const SIZE_CLASS: Record<StatusPillSize, string> = {
  sm: "px-2 py-0.5 text-[12px]",
  md: "px-2.5 py-1 text-[13px]",
};

export function StatusPill({
  label,
  tone = "neutral",
  size = "sm",
}: {
  readonly label: string;
  readonly tone?: StatusPillTone;
  readonly size?: StatusPillSize;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 rounded-full font-medium",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}
