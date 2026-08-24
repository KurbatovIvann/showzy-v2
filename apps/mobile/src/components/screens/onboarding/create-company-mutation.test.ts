import { describe, expect, it } from "vitest";

import type { MutationCallOptions } from "@showzy/contract";

import { createContractMutationController } from "../../../api/contract-mutation";
import type {
  CompanyMembership,
  CreateCompanyInput,
} from "./create-company-form";
import { bindCreateCompanyMutate } from "./create-company-mutation";

const membership: CompanyMembership = {
  membershipId: "11111111-1111-4111-8111-111111111111",
  role: "owner",
  company: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Cafe",
    slug: "cafe",
    prefix: "CAF",
  },
};

describe("bindCreateCompanyMutate", () => {
  it("calls companies.create with only name and slug and reuses the attempt on retry", async () => {
    const calls: Array<{
      readonly input: CreateCompanyInput;
      readonly key: string;
    }> = [];
    const controller = createContractMutationController<
      CreateCompanyInput,
      CompanyMembership
    >({
      mutate: bindCreateCompanyMutate({
        client: {
          companies: {
            create: (input, options: MutationCallOptions) => {
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

    await controller.submit({ name: "Cafe", slug: "cafe" }).catch(() => {});
    await controller.retry().catch(() => {});

    expect(calls).toHaveLength(2);
    expect(calls[0]?.input).toEqual({ name: "Cafe", slug: "cafe" });
    expect(Object.keys(calls[0]?.input ?? {})).toEqual(["name", "slug"]);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key.length).toBeGreaterThan(0);
    expect(membership.company.slug).toBe("cafe");
  });
});
