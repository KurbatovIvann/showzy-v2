import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";
import { isWireError } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { bindDocumentFormMutate } from "./document-form-mutation";
import type { DocumentFormWrite } from "../form/document-form-plan";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";
const COUNTERPARTY_ID = "22222222-2222-4222-8222-222222222222";

describe("bindDocumentFormMutate", () => {
  it("calls createFromOrder with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const write: DocumentFormWrite = {
      kind: "createFromOrder",
      input: { orderId: ORDER_ID, type: "payment_invoice" },
    };
    const controller = createContractMutationController({
      mutate: bindDocumentFormMutate({
        client: {
          documents: {
            createFromOrder: (input, options: MutationCallOptions) => {
              calls.push({
                input,
                key: options.context.idempotencyKey,
              });
              return Promise.reject(new TypeError("Failed to fetch"));
            },
          },
        },
      }),
    });

    await controller.submit(write).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.input).toEqual({
      orderId: ORDER_ID,
      type: "payment_invoice",
    });
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });

  it("rejects a create payload that fails the wire schema before calling transport", async () => {
    const mutate = bindDocumentFormMutate({
      client: {
        documents: {
          createFromOrder: () => Promise.reject(new Error("unused")),
        },
      },
    });
    const result = mutate(
      {
        kind: "createFromOrder",
        input: { orderId: "not-a-uuid", type: "payment_invoice" },
      },
      {
        context: { idempotencyKey: "k" },
      },
    );
    await expect(result).rejects.toSatisfy(
      (error: unknown) => isWireError(error) && error.code === "VALIDATION",
    );
  });

  it("forwards optional counterpartyId on the wire", async () => {
    const calls: unknown[] = [];
    const mutate = bindDocumentFormMutate({
      client: {
        documents: {
          createFromOrder: (input) => {
            calls.push(input);
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
              templateName: "payment_invoice",
              basis: null,
              createdAt: "2026-08-29T12:00:00.000Z",
              items: [
                {
                  itemId: "33333333-3333-4333-8333-333333333333",
                  productId: "44444444-4444-4444-8444-444444444444",
                  variantId: null,
                  titleSnapshot: "Торт",
                  quantityMilli: "1000",
                  unitPriceMinor: "1000",
                  discountKind: "none",
                  discountValue: "0",
                  discountAmountMinor: "0",
                  taxTreatment: "exempt",
                  taxRateBp: 0,
                  taxAmountMinor: "0",
                  netAmountMinor: "1000",
                  grossAmountMinor: "1000",
                  currency: "UAH",
                },
              ],
            });
          },
        },
      },
    });
    await mutate(
      {
        kind: "createFromOrder",
        input: {
          orderId: ORDER_ID,
          type: "delivery_note",
          counterpartyId: COUNTERPARTY_ID,
          layoutKey: "delivery_note.parties",
          basis: "Договір № 1",
        },
      },
      { context: { idempotencyKey: "k" } },
    );
    expect(calls).toEqual([
      {
        orderId: ORDER_ID,
        type: "delivery_note",
        counterpartyId: COUNTERPARTY_ID,
        layoutKey: "delivery_note.parties",
        basis: "Договір № 1",
      },
    ]);
  });
});
