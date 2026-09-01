import { Button } from "../../components/ui/button";
import type { CompanyScopeCopy } from "../../i18n/company-scope";

export function CompanyScopeLoading(props: { readonly label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-[15px] text-muted">{props.label}</p>
    </main>
  );
}

export function CompanyScopeError(props: {
  readonly copy: CompanyScopeCopy;
  readonly onRetry: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4">
      <h1 className="text-lg font-semibold text-ink">
        {props.copy.errorTitle}
      </h1>
      <p className="max-w-md text-center text-[15px] text-muted">
        {props.copy.errorDescription}
      </p>
      <Button type="button" onClick={props.onRetry}>
        {props.copy.retry}
      </Button>
    </main>
  );
}
