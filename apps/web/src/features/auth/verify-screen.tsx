import { Navigate } from "@tanstack/react-router";

import { useVerifyScreen } from "../../auth/use-verify";
import { Button } from "../../components/ui/button";
import { AuthShell } from "./auth-shell";
import { Banner } from "./banner";
import { OtpInput } from "./otp-input";

export function VerifyScreen() {
  const model = useVerifyScreen();
  if (model.kind === "redirect-sign-in") {
    return <Navigate to="/sign-in" />;
  }

  return (
    <AuthShell>
      <h1
        id="verify-title"
        className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[28px]"
      >
        {model.copy.verifyTitle}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {model.message}
      </p>
      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          model.submit();
        }}
      >
        <OtpInput
          value={model.code}
          length={model.otpLength}
          disabled={model.busy || model.locked}
          error={model.otpError ?? false}
          labelledBy="verify-title"
          digitLabel={model.digitLabel}
          onChange={(code) => {
            model.setCode(code);
            if (code.length === model.otpLength) {
              model.submit(code);
            }
          }}
        />
        {model.banner ? (
          <div className="mt-4">
            <Banner message={model.banner} />
          </div>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="mt-8 w-full"
          disabled={model.submitDisabled}
        >
          {model.busy ? model.copy.verifyLoading : model.copy.verifyCode}
        </Button>
      </form>
      <div className="mt-6 flex flex-col gap-3 text-[15px] sm:flex-row sm:items-center sm:gap-5">
        {model.resendWaitLabel !== null ? (
          <p className="text-muted">{model.resendWaitLabel}</p>
        ) : (
          <button
            type="button"
            disabled={model.resendBusy}
            onClick={model.resend}
            className="text-left font-medium text-action transition-opacity duration-150 ease-soft hover:enabled:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-action disabled:opacity-40"
          >
            {model.copy.resendCode}
          </button>
        )}
        <button
          type="button"
          onClick={model.back}
          className="text-left text-muted transition-colors duration-150 ease-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          {model.backLabel}
        </button>
      </div>
    </AuthShell>
  );
}
