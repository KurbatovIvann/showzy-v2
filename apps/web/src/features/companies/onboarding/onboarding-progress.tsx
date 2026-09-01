import {
  stepLabelCopy,
  type OnboardingCopy,
} from "../../../i18n/companies/onboarding";

const ONBOARDING_STEPS = 2;

export function OnboardingProgress({
  step,
  copy,
}: {
  readonly step: 1 | 2;
  readonly copy: OnboardingCopy;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={ONBOARDING_STEPS}
      aria-valuenow={step}
      aria-label={stepLabelCopy(copy, step, ONBOARDING_STEPS)}
      className="flex gap-1.5"
    >
      {Array.from({ length: ONBOARDING_STEPS }, (_, index) => (
        <div
          key={index}
          className={
            index < step
              ? "h-1.5 flex-1 rounded-full bg-ink"
              : "h-1.5 flex-1 rounded-full bg-line"
          }
        />
      ))}
    </div>
  );
}
