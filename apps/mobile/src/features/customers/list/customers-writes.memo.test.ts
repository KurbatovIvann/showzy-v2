import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("customers writes-hook referential stability", () => {
  it("stabilizes list write callbacks so pane memo deps and row memo bail", () => {
    const clientWrites = readFileSync(
      new URL("./use-client-writes.ts", import.meta.url),
      "utf8",
    );
    const statusWrites = readFileSync(
      new URL("../shared/use-customer-status-writes.ts", import.meta.url),
      "utf8",
    );
    const groupWrites = readFileSync(
      new URL("../groups/use-group-writes.ts", import.meta.url),
      "utf8",
    );
    const counterpartyWrites = readFileSync(
      new URL("../counterparties/use-counterparty-writes.ts", import.meta.url),
      "utf8",
    );
    const inviteWrites = readFileSync(
      new URL("../invitations/use-invite-writes.ts", import.meta.url),
      "utf8",
    );
    const clientsPane = readFileSync(
      new URL("./clients-list-pane.tsx", import.meta.url),
      "utf8",
    );
    const groupsPane = readFileSync(
      new URL("../groups/groups-list-pane.tsx", import.meta.url),
      "utf8",
    );
    const counterpartiesPane = readFileSync(
      new URL("../counterparties/counterparties-list-pane.tsx", import.meta.url),
      "utf8",
    );
    const invitationsPane = readFileSync(
      new URL("../invitations/invitations-list-pane.tsx", import.meta.url),
      "utf8",
    );
    const clientRow = readFileSync(
      new URL("./client-row.tsx", import.meta.url),
      "utf8",
    );
    expect(statusWrites).toContain("const archive = useCallback(");
    expect(statusWrites).toContain("return useMemo(");
    expect(statusWrites).toContain("argsRef.current");
    expect(clientWrites).toContain("const openEdit = useCallback(");
    expect(clientWrites).toContain("return useMemo(");
    expect(groupWrites).toContain("const remove = useCallback(");
    expect(groupWrites).toContain("return useMemo(");
    expect(counterpartyWrites).toContain("const openEdit = useCallback(");
    expect(inviteWrites).toContain("const revoke = useCallback(");
    expect(inviteWrites).toContain("return useMemo(");
    expect(clientsPane).toContain("[model.archive]");
    expect(groupsPane).toContain("[model.remove]");
    expect(counterpartiesPane).toContain("[model.remove]");
    expect(invitationsPane).toContain("[model.revoke]");
    expect(clientRow).toContain("memo(function ClientRow");
    expect(clientRow).toContain("onArchive: (id: string) => void");
  });

  it("dedupes editor lifecycle onto the shared confirm+mutate helper", () => {
    const lifecycle = readFileSync(
      new URL("../form/use-customer-form-lifecycle.ts", import.meta.url),
      "utf8",
    );
    const counterpartyLifecycle = readFileSync(
      new URL(
        "../counterparties/use-counterparty-form-lifecycle.ts",
        import.meta.url,
      ),
      "utf8",
    );
    expect(lifecycle).toContain("useCustomerStatusWrites");
    expect(lifecycle).not.toContain("presentConfirmDialog");
    expect(counterpartyLifecycle).toContain("useCounterpartyDeleteWrite");
    expect(counterpartyLifecycle).not.toContain("presentConfirmDialog");
  });
});
