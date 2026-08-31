import { useEffect, useRef } from "react";

import { cx } from "../../components/ui/cx";

function otpHasError(error: boolean | string | undefined): boolean {
  return error === true || (typeof error === "string" && error.length > 0);
}

function otpErrorText(error: boolean | string | undefined): string | null {
  return typeof error === "string" && error.length > 0 ? error : null;
}

/**
 * Six-cell OTP field from the web canvas `Verify` frame. Value is a single
 * digit string so the OTP reducer stays the source of truth.
 */
export function OtpInput({
  value,
  length,
  onChange,
  disabled,
  error,
  labelledBy,
  digitLabel,
}: {
  readonly value: string;
  readonly length: number;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly error?: boolean | string;
  readonly labelledBy?: string;
  readonly digitLabel: (index: number) => string;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");
  const isDisabled = disabled === true;
  const hasError = otpHasError(error);
  const errorText = otpErrorText(error);

  useEffect(() => {
    if (isDisabled) {
      return;
    }
    inputs.current[Math.min(value.length, length - 1)]?.focus();
  }, [isDisabled, length, value.length]);

  function setValue(next: string): void {
    onChange(next.replaceAll(/\D/g, "").slice(0, length));
  }

  function applyDigits(raw: string, start: number): void {
    const incoming = raw.replaceAll(/\D/g, "").slice(0, length - start);
    if (incoming.length === 0) {
      return;
    }
    const prefix = value.slice(0, start);
    setValue(`${prefix}${incoming}`);
    const focusAt = Math.min(start + incoming.length, length - 1);
    inputs.current[focusAt]?.focus();
  }

  return (
    <div>
      <div
        role="group"
        aria-labelledby={labelledBy}
        className="flex w-full gap-1.5 sm:gap-2"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            value={digit}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={digitLabel(index + 1)}
            aria-invalid={hasError ? "true" : undefined}
            disabled={isDisabled}
            onChange={(event) => {
              const raw = event.target.value.replaceAll(/\D/g, "");
              if (raw.length === 0) {
                setValue(value.slice(0, index) + value.slice(index + 1));
                return;
              }
              if (raw.length === 1) {
                setValue(value.slice(0, index) + raw + value.slice(index + 1));
                inputs.current[Math.min(index + 1, length - 1)]?.focus();
                return;
              }
              applyDigits(raw, index);
            }}
            onPaste={(event) => {
              event.preventDefault();
              applyDigits(event.clipboardData.getData("text"), index);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Backspace") {
                return;
              }
              if (digits[index] !== "") {
                return;
              }
              if (index === 0) {
                return;
              }
              event.preventDefault();
              setValue(value.slice(0, index - 1) + value.slice(index));
              inputs.current[index - 1]?.focus();
            }}
            className={cx(
              "h-12 min-w-0 flex-1 rounded-field border bg-surface text-center",
              "text-[20px] font-semibold text-ink sm:h-14 sm:text-[22px]",
              "transition-colors duration-150 ease-soft",
              "focus:outline-none focus:ring-2 focus:ring-actionSoft",
              hasError
                ? "border-danger focus:border-danger"
                : "border-line focus:border-action",
              "disabled:opacity-40",
            )}
          />
        ))}
      </div>
      {errorText !== null ? (
        <p className="mt-2 text-[13px] text-danger">{errorText}</p>
      ) : null}
    </div>
  );
}
