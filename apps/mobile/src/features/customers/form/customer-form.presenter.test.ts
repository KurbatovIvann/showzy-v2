import { describe, expect, it } from "vitest";

import { customersCopy } from "../../../i18n/customers";
import { emptyCustomerFormDraft } from "./customer-form-draft";
import {
  presentCustomerFormCopy,
  presentCustomerFormView,
  presentLinkedCounterparties,
} from "./customer-form.presenter";

const copy = customersCopy("en");

describe("presentLinkedCounterparties", () => {
  it("formats EDRPOU or falls back to the empty label", () => {
    const rows = presentLinkedCounterparties({
      items: [
        { id: "a", name: "Acme", edrpou: "12345678" },
        { id: "b", name: "Blank", edrpou: null },
        { id: "c", name: "Empty", edrpou: "" },
      ],
      emptyEdrpou: "No EDRPOU",
      edrpouBadge: "EDRPOU {{edrpou}}",
    });
    expect(rows).toEqual([
      { id: "a", name: "Acme", edrpouLabel: "EDRPOU 12345678" },
      { id: "b", name: "Blank", edrpouLabel: "No EDRPOU" },
      { id: "c", name: "Empty", edrpouLabel: "No EDRPOU" },
    ]);
  });
});

describe("presentCustomerFormView", () => {
  const lookups = {
    groupNameById: new Map<string, string>(),
    priceListNameById: new Map<string, string>(),
    priceListIdByGroupId: new Map<string, string | null>(),
    groupOptions: [],
    priceListOptions: [],
  };

  it("disables edit submit when the draft is not dirty", () => {
    const resolved = presentCustomerFormCopy({
      formCopy: copy.form,
      mode: "edit",
      submitted: false,
      nameMessage: undefined,
      phoneMessage: undefined,
      emailMessage: undefined,
      notesMessage: undefined,
      mutationError: null,
      lastWrite: null,
      isMutationError: false,
      pending: false,
      clientReady: true,
    });
    const view = presentCustomerFormView({
      copy,
      mode: "edit",
      origin: emptyCustomerFormDraft(),
      loadState: { kind: "ready" },
      resolved,
      pending: false,
      isDirty: false,
      picker: null,
      groupId: null,
      priceListId: null,
      lookups,
      archived: false,
      canWrite: true,
      canDelete: true,
      counterpartiesStatus: "success",
      linkedItems: [],
      lifecycleBanner: null,
    });
    expect(view.submitDisabled).toBe(true);
    expect(view.showArchive).toBe(true);
    expect(view.showRestore).toBe(false);
    expect(view.showDelete).toBe(false);
  });

  it("shows restore and delete when the client is archived", () => {
    const resolved = presentCustomerFormCopy({
      formCopy: copy.form,
      mode: "edit",
      submitted: false,
      nameMessage: undefined,
      phoneMessage: undefined,
      emailMessage: undefined,
      notesMessage: undefined,
      mutationError: null,
      lastWrite: null,
      isMutationError: false,
      pending: false,
      clientReady: true,
    });
    const view = presentCustomerFormView({
      copy,
      mode: "edit",
      origin: emptyCustomerFormDraft(),
      loadState: { kind: "ready" },
      resolved,
      pending: false,
      isDirty: true,
      picker: null,
      groupId: null,
      priceListId: null,
      lookups,
      archived: true,
      canWrite: true,
      canDelete: true,
      counterpartiesStatus: "success",
      linkedItems: [],
      lifecycleBanner: "write failed",
    });
    expect(view.showArchive).toBe(false);
    expect(view.showRestore).toBe(true);
    expect(view.showDelete).toBe(true);
    expect(view.banner).toBe("write failed");
    expect(view.submitDisabled).toBe(false);
  });
});
