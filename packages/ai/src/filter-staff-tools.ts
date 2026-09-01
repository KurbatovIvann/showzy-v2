import { aiToolSourcesForPrincipal } from "@showzy/contract";
import { staffHasPermission, type StaffMembership } from "@showzy/core";
import type { ActionContract } from "@showzy/core/contract";

/**
 * Staff AI tools: client + exposed + staff, then permission-gated through
 * `staffHasPermission` (owner-all short-circuit). Never read
 * `membership.permissions` directly.
 */
export function filterStaffAiTools(
  contracts: readonly ActionContract[],
  membership: StaffMembership,
): readonly ActionContract[] {
  return aiToolSourcesForPrincipal(contracts, "staff").filter((contract) =>
    contract.permissions.every((permission) =>
      staffHasPermission(membership, permission),
    ),
  );
}
