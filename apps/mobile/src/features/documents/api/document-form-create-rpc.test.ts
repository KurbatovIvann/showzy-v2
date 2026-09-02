import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { bindDocumentFormMutate } from "./document-form-mutation";
import { listDocumentLayoutsQueryOptions } from "./document-layouts-query";
import type { DocumentFormDraft } from "../form/document-form-draft";
import { defaultLayoutKey } from "../form/document-form-layouts";
import { createFromOrderPayload } from "../form/document-form-plan";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const COUNTERPARTY_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const INVOICE_LAYOUTS = [
  {
    key: "payment_invoice.plain" as const,
    type: "payment_invoice" as const,
    labelUk: "Простий рахунок",
    labelEn: "Plain invoice",
    isDefault: false,
  },
  {
    key: "payment_invoice.branded" as const,
    type: "payment_invoice" as const,
    labelUk: "Фірмовий рахунок",
    labelEn: "Branded invoice",
    isDefault: true,
  },
];

describe("listLayouts then createFromOrder", () => {
  it("creates with the selected catalog key after listing layouts for the type", async () => {
    const listCalls: unknown[] = [];
    const createCalls: unknown[] = [];

    const listed = await (async (input: { readonly type: "payment_invoice" }) => {
      listCalls.push(input);
      return { layouts: INVOICE_LAYOUTS };
    })({ type: "payment_invoice" });

    const selectedKey = defaultLayoutKey(listed.layouts);
    expect(selectedKey).toBe("payment_invoice.branded");
    expect(listCalls).toEqual([{ type: "payment_invoice" }]);

    const draft: DocumentFormDraft = {
      type: "payment_invoice",
      orderId: ORDER_ID,
      counterpartyId: COUNTERPARTY_ID,
      layoutKey: selectedKey ?? "",
      basis: " ignored on invoice ",
    };
    const payload = createFromOrderPayload(draft);
    expect(payload).toEqual({
      orderId: ORDER_ID,
      type: "payment_invoice",
      layoutKey: "payment_invoice.branded",
      counterpartyId: COUNTERPARTY_ID,
    });

    const mutate = bindDocumentFormMutate({
      client: {
        documents: {
          createFromOrder: (input, _options: MutationCallOptions) => {
            createCalls.push(input);
            return Promise.resolve({
              documentId: DOCUMENT_ID,
              orderId: input.orderId,
              counterpartyId: input.counterpartyId ?? null,
              type: input.type,
              status: "issued",
              documentNumber: "SHZ-РХ-000001",
              issuedOn: "2026-08-29",
              supplierDetails: {
                kind: "seller",
                name: "Showzy",
                prefix: "SHZ",
                companyType: "fop",
                legalName: "FOP",
                edrpou: "12345678",
                legalAddress: null,
                iban: null,
                bankName: null,
                bankMfo: null,
                bankEdrpou: null,
                phone: null,
                email: null,
              },
              buyerDetails: { kind: "customer", displayName: "Марія" },
              totalNetMinor: "1000",
              totalTaxMinor: "0",
              totalGrossMinor: "1000",
              currency: "UAH",
              templateSource: "system",
              templateName: input.layoutKey ?? "payment_invoice.branded",
              basis: input.basis ?? null,
              createdAt: "2026-08-29T12:00:00.000Z",
              items: [],
            });
          },
        },
      },
    });
    await mutate(
      {
        kind: "createFromOrder",
        input: payload ?? { orderId: ORDER_ID, type: "payment_invoice" },
      },
      { context: { idempotencyKey: "k" } },
    );
    expect(createCalls).toEqual([
      {
        orderId: ORDER_ID,
        type: "payment_invoice",
        layoutKey: "payment_invoice.branded",
        counterpartyId: COUNTERPARTY_ID,
      },
    ]);
    const serialized = JSON.stringify(createCalls[0]);
    expect(serialized).not.toContain("companyId");
    expect(serialized).not.toContain("\"basis\"");
    expect(serialized).not.toContain("customerId");
    expect(serialized).not.toContain("money");
  });

  it("keeps listLayouts behind the create-screen enable flag", () => {
    const options = listDocumentLayoutsQueryOptions({
      client: null,
      companyId: COMPANY_A,
      type: "payment_invoice",
      getActiveCompany: () => COMPANY_A,
      enabled: false,
    });
    expect(options.enabled).toBe(false);
  });
});
