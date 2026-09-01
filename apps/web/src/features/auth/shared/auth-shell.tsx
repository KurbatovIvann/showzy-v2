import type { ReactNode } from "react";

/** Auth chrome from the web canvas `AuthShell` (SHO-312, ADR-0024). */
export function AuthShell({
  children,
  footer,
}: {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center overflow-y-auto bg-canvas px-4 py-8 sm:px-6 sm:py-16">
      <div className="w-full max-w-[440px]">
        <div className="rounded-panel bg-surface px-5 py-8 shadow-auth sm:px-10 sm:py-11">
          {children}
        </div>
        {footer}
      </div>
    </main>
  );
}
