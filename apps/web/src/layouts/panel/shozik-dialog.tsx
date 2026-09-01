import { useEffect } from "react";

import { Button } from "../../components/ui/button";
import { usePanelChromeCopy } from "./use-panel-chrome-copy";

/** Shared AI-assistant stub dialog for the sidebar and the mobile tab bar. */
export function ShozikDialog({ onClose }: { readonly onClose: () => void }) {
  const copy = usePanelChromeCopy();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 p-4">
      <button
        type="button"
        aria-label={copy.closeAi}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shozik-title"
        className="relative w-full max-w-[380px] rounded-panel bg-surface p-6 shadow-auth"
      >
        <h2 id="shozik-title" className="text-[20px] font-semibold text-ink">
          {copy.aiName}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-muted">{copy.aiHint}</p>
        <Button
          type="button"
          autoFocus
          className="mt-6"
          onClick={onClose}
          size="sm"
        >
          {copy.close}
        </Button>
      </section>
    </div>
  );
}

export function MockAccountPage({
  title,
  body,
  onClose,
}: {
  readonly title: string;
  readonly body: string;
  readonly onClose: () => void;
}) {
  const copy = usePanelChromeCopy();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/25 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-mock-title"
        className="w-full max-w-md rounded-panel border border-line bg-surface p-6 shadow-auth"
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-faint">
          {copy.mockEyebrow}
        </p>
        <h2
          id="account-mock-title"
          className="mt-2 text-[20px] font-semibold text-ink"
        >
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-muted">{body}</p>
        <Button type="button" className="mt-6" onClick={onClose} size="sm">
          {copy.close}
        </Button>
      </div>
    </div>
  );
}
