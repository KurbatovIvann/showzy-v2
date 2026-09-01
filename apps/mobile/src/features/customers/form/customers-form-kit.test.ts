import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("customers forms adopt form-kit", () => {
  it("uses shared save, guard, scaffold, and text field on all four CRM forms", () => {
    const customerHook = read("./use-customer-form.ts");
    const customerSave = read("./use-customer-save.ts");
    const customerView = read("./customer-form-view.tsx");
    const customerFields = read("./customer-form-fields.tsx");
    const groupHook = read("../groups/use-group-form.ts");
    const groupSave = read("../groups/use-group-save.ts");
    const groupView = read("../groups/group-form-view.tsx");
    const groupFields = read("../groups/group-form-fields.tsx");
    const counterpartyHook = read("../counterparties/use-counterparty-form.ts");
    const counterpartySave = read("../counterparties/use-counterparty-save.ts");
    const counterpartyView = read(
      "../counterparties/counterparty-form-view.tsx",
    );
    const counterpartyFields = read(
      "../counterparties/counterparty-form-fields.tsx",
    );
    const invitationHook = read("../invitations/use-invitation-form.ts");
    const invitationSave = read("../invitations/use-invitation-save.ts");
    const invitationView = read("../invitations/invitation-form-view.tsx");
    const invitationFields = read("../invitations/invitation-form-fields.tsx");
    const invitationLeave = read("../invitations/invitation-form-leave.ts");

    expect(customerHook).toContain("useUnsavedGuard");
    expect(customerHook).toContain("presentCustomerFormView");
    expect(customerHook).not.toContain("useUnsavedCustomerGuard");
    expect(customerSave).toContain("useFormSave");
    expect(customerSave).toContain("bindCustomerFormMutate");
    expect(customerView).toContain("FormScreenScaffold");
    expect(customerView).not.toContain("SafeAreaView");
    expect(customerFields).toContain("FormTextField");
    expect(customerFields).not.toContain("<Controller");

    expect(groupHook).toContain("useUnsavedGuard");
    expect(groupHook).toContain("presentGroupFormView");
    expect(groupHook).not.toContain("useUnsavedGroupGuard");
    expect(groupSave).toContain("useFormSave");
    expect(groupView).toContain("FormScreenScaffold");
    expect(groupView).not.toContain("SafeAreaView");
    expect(groupFields).toContain("FormTextField");
    expect(groupFields).not.toContain("<Controller");

    expect(counterpartyHook).toContain("useUnsavedGuard");
    expect(counterpartyHook).toContain("presentCounterpartyFormView");
    expect(counterpartyHook).not.toContain("useUnsavedCounterpartyGuard");
    expect(counterpartySave).toContain("useFormSave");
    expect(counterpartyView).toContain("FormScreenScaffold");
    expect(counterpartyView).not.toContain("SafeAreaView");
    expect(counterpartyFields).toContain("FormTextField");
    expect(counterpartyFields).not.toContain("<Controller");

    expect(invitationHook).toContain("useUnsavedGuard");
    expect(invitationHook).toContain('armedLeave: "dispatch-only"');
    expect(invitationHook).toContain("presentInvitationFormView");
    expect(invitationHook).not.toContain("useUnsavedInvitationGuard");
    expect(invitationSave).toContain("useFormSave");
    expect(invitationView).toContain("FormScreenScaffold");
    expect(invitationView).toContain("useMemo");
    expect(invitationView).toContain("INVITE_EXPIRES_MIN_MS");
    expect(invitationView).not.toContain("SafeAreaView");
    expect(invitationFields).toContain("FormTextField");
    expect(invitationFields).not.toContain("<Controller");
    expect(invitationLeave).toContain("resolveArmedFormLeave");
    expect(invitationLeave).toContain('mode: "dispatch-only"');
  });
});
