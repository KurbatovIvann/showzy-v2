import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./use-order-detail-actions.ts", import.meta.url),
  "utf8",
);

describe("useOrderDetailActions mutation instances", () => {
  it("mints four distinct useContractMutation attempts and does not reuse confirm for start", () => {
    expect(SOURCE.match(/useContractMutation\(/g)?.length).toBe(4);
    expect(SOURCE).toContain("confirmMutation");
    expect(SOURCE).toContain("startMutation");
    expect(SOURCE).toContain("completeMutation");
    expect(SOURCE).toContain("cancelMutation");
    expect(SOURCE).toContain('case "start":');
    expect(SOURCE).toContain("return startMutation");
    expect(SOURCE).not.toContain(
      'kind === "confirm" ? confirmMutation : cancelMutation',
    );
  });
});
