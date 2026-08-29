import { describe, expect, it } from "vitest";

import { isWireError, type MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import { bindCompanyLegalFormMutate } from "./company-legal-form-mutation";
import type { CompanyLegalFormWrite } from "../form/company-legal-form-plan";

const COMPANY_ID = "0f0e2d5c-4a1b-4c3d-9e8f-102938475601";

function validWrite(): CompanyLegalFormWrite {
  return {
    kind: "updateLegal",
    input: {
      companyType: "tov",
      legalName: "ТОВ Софі",
      edrpou: null,
      legalAddress: null,
      iban: null,
      bankName: null,
      bankMfo: null,
      bankEdrpou: null,
      phone: null,
      email: null,
    },
  };
}

describe("bindCompanyLegalFormMutate", () => {
  it("calls updateLegal with the attempt options and reuses the key on retry", async () => {
    const calls: Array<{
      readonly method: string;
      readonly input: unknown;
      readonly key: string;
    }> = [];
    const write = validWrite();
    const controller = createContractMutationController({
      mutate: bindCompanyLegalFormMutate({
        client: {
          companies: {
            updateLegal: (input, options: MutationCallOptions) => {
              calls.push({
                method: "updateLegal",
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
    expect(calls[0]?.method).toBe("updateLegal");
    expect(calls[0]?.input).toEqual(write.input);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
  });

  it("rejects a payload that fails the wire schema before calling transport", async () => {
    const calls: unknown[] = [];
    const mutate = bindCompanyLegalFormMutate({
      client: {
        companies: {
          updateLegal: (input) => {
            calls.push(input);
            return Promise.resolve({ id: COMPANY_ID });
          },
        },
      },
    });
    const result = mutate(
      {
        kind: "updateLegal",
        input: {
          companyType: "fop",
          legalName: "",
          edrpou: null,
          legalAddress: null,
          iban: null,
          bankName: null,
          bankMfo: null,
          bankEdrpou: null,
          phone: null,
          email: null,
        },
      },
      {
        context: { idempotencyKey: "k" },
      },
    );
    await expect(result).rejects.toSatisfy(
      (error: unknown) => isWireError(error) && error.code === "VALIDATION",
    );
    expect(calls).toEqual([]);
  });

  it("sends a valid ФОП/ТОВ upsert through transport", async () => {
    const calls: unknown[] = [];
    const mutate = bindCompanyLegalFormMutate({
      client: {
        companies: {
          updateLegal: (input) => {
            calls.push(input);
            return Promise.resolve({ id: COMPANY_ID });
          },
        },
      },
    });
    await expect(
      mutate(validWrite(), { context: { idempotencyKey: "k" } }),
    ).resolves.toEqual({ id: COMPANY_ID });
    expect(calls).toEqual([validWrite().input]);
  });
});
