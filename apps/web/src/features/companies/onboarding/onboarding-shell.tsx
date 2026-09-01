import type { ReactNode } from "react";

import type { OnboardingCopy } from "../../../i18n/companies/onboarding";
import { AuthShell } from "../../auth/auth-shell";
import { OnboardingProgress } from "./onboarding-progress";

/**
 * Full-shell onboarding chrome: AuthShell card + progress, no LeftNav.
 * Secondary action sits outside the card (canvas OnboardingShell).
 */
export function OnboardingShell({
  step,
  copy,
  title,
  subtitle,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
  children,
}: {
  readonly step: 1 | 2;
  readonly copy: OnboardingCopy;
  readonly title: string;
  readonly subtitle: string;
  readonly secondaryLabel?: string;
  readonly onSecondary?: () => void;
  readonly secondaryDisabled?: boolean;
  readonly children: ReactNode;
}) {
  const skip =
    secondaryLabel !== undefined && onSecondary !== undefined ? (
      <button
        type="button"
        onClick={onSecondary}
        disabled={secondaryDisabled}
        className="mx-auto mt-5 block min-h-[48px] px-3 text-[15px] font-semibold text-ink underline-offset-4 hover:underline hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 disabled:opacity-40"
      >
        {secondaryLabel}
      </button>
    ) : undefined;

  return (
    <AuthShell footer={skip}>
      <OnboardingProgress step={step} copy={copy} />
      <header className="pt-6">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {subtitle}
        </p>
      </header>
      <div className="mt-7">{children}</div>
    </AuthShell>
  );
}
