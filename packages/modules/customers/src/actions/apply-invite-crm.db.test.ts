import { randomUUID } from "node:crypto";

import {
  createTestKit,
  crossTenantSuite,
  isolationCase,
  kitIdentities,
  type TestKit,
} from "@showzy/core/testing";
import { customerGroups } from "@showzy/db/schema/customers";
import { afterAll, beforeAll } from "vitest";

import { applyInviteCrm } from "./apply-invite-crm.js";

const fixtures = {
  groupA: randomUUID(),
};

let kit: TestKit;

beforeAll(async () => {
  kit = await createTestKit();
  await kit.db.runtime.db.insert(customerGroups).values({
    id: fixtures.groupA,
    companyId: kitIdentities.companies.a,
    name: "Invite apply group",
    slug: `invite-apply-${fixtures.groupA}`,
  });
});

afterAll(async () => {
  await kit.db.close();
});

crossTenantSuite(
  () => kit,
  [
    isolationCase(
      applyInviteCrm,
      {
        input: {
          groupId: fixtures.groupA,
          matchUnlinkedContact: false,
        },
      },
      {
        input: {
          groupId: randomUUID(),
          matchUnlinkedContact: false,
        },
      },
    ),
  ],
);
