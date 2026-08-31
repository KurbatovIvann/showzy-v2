import { Navigate } from "@tanstack/react-router";

import { authPolicy } from "../../auth/otp/policy";
import { useSignInScreen } from "../../auth/use-sign-in";
import { Button } from "../../components/ui/button";
import { cx } from "../../components/ui/cx";
import { AuthShell } from "./auth-shell";
import { Banner } from "./banner";
import { ChannelTabs } from "./channel-tabs";

const PHONE_CONTROL =
  "w-full bg-transparent py-3.5 text-[17px] text-ink placeholder:text-faint focus:outline-none disabled:opacity-40";
const EMAIL_CONTROL =
  "mt-2 w-full rounded-field border bg-canvas px-4 py-3.5 text-[17px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-actionSoft disabled:opacity-40";

export function SignInScreen() {
  const model = useSignInScreen();
  if (model.kind === "redirect-verify") {
    return <Navigate to="/verify" />;
  }

  return (
    <AuthShell>
      <h1 className="text-[44px] font-bold leading-none tracking-tight text-ink">
        ШОЗІ
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {model.copy.tagline}
      </p>
      <ChannelTabs
        label={model.copy.welcome}
        tabs={model.channels}
        selected={model.channel}
        disabled={model.busy}
        onSelect={model.setChannel}
      />
      <form
        className="mt-7"
        onSubmit={(event) => {
          event.preventDefault();
          model.submit();
        }}
      >
        {model.channel === "phone" ? (
          <div>
            <label
              htmlFor="sign-in-phone"
              className="block text-[13px] font-medium text-muted"
            >
              {model.copy.phoneLabel}
            </label>
            <div
              className={cx(
                "mt-2 flex items-center gap-2 rounded-field border bg-canvas px-4",
                "focus-within:ring-2 focus-within:ring-actionSoft",
                model.fieldError
                  ? "border-danger focus-within:border-danger"
                  : "border-line focus-within:border-action",
              )}
            >
              <span className="text-[17px] text-ink">
                {authPolicy.defaultPhonePrefix}
              </span>
              <span aria-hidden className="h-6 w-px bg-line" />
              <input
                id="sign-in-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={model.phoneDigits}
                maxLength={9}
                placeholder={model.copy.phonePlaceholder}
                disabled={model.busy}
                aria-invalid={model.fieldError ? "true" : undefined}
                onChange={(event) => {
                  model.setPhoneDigits(event.target.value);
                }}
                className={PHONE_CONTROL}
              />
            </div>
            {model.fieldError ? (
              <p className="mt-1 text-[12px] text-danger">{model.fieldError}</p>
            ) : null}
          </div>
        ) : (
          <div>
            <label
              htmlFor="sign-in-email"
              className="block text-[13px] font-medium text-muted"
            >
              {model.copy.emailLabel}
            </label>
            <input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              value={model.email}
              placeholder={model.copy.emailPlaceholder}
              disabled={model.busy}
              aria-invalid={model.fieldError ? "true" : undefined}
              onChange={(event) => {
                model.setEmail(event.target.value);
              }}
              className={cx(
                EMAIL_CONTROL,
                model.fieldError
                  ? "border-danger focus:border-danger"
                  : "border-line focus:border-action",
              )}
            />
            {model.fieldError ? (
              <p className="mt-1 text-[12px] text-danger">{model.fieldError}</p>
            ) : null}
          </div>
        )}
        {model.banner ? (
          <div className="mt-4">
            <Banner message={model.banner} />
          </div>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="mt-7 w-full"
          disabled={model.submitDisabled}
        >
          {model.busy ? model.copy.continueLoading : model.copy.continue}
        </Button>
      </form>
    </AuthShell>
  );
}
