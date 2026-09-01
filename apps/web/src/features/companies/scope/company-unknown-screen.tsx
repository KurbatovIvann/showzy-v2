import { Link } from "@tanstack/react-router";

import { Card } from "../../../components/ui/card";
import { useCompanyScopeCopy } from "./use-company-scope-copy";

const PRIMARY_LINK_CLASS =
  "mt-5 inline-flex items-center justify-center rounded-full bg-ink px-5 py-3 " +
  "text-[15px] font-semibold text-white hover:opacity-90 " +
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-action";

export function CompanyUnknownScreen() {
  const copy = useCompanyScopeCopy();
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8">
      <Card className="w-full max-w-[440px] p-6">
        <h1 className="text-lg font-semibold text-ink">{copy.unknownTitle}</h1>
        <p className="mt-2 text-[15px] text-muted">{copy.unknownDescription}</p>
        <Link className={PRIMARY_LINK_CLASS} to="/">
          {copy.backToPicker}
        </Link>
      </Card>
    </main>
  );
}
