import {
  filterStaffAiTools,
  PROVIDER_TOOL_NAME_PATTERN,
  staffAssistantTools,
  toProviderToolName,
} from "@showzy/ai";
import { describe, expect, it, vi } from "vitest";

import { createActionRegistry } from "../composition.js";

const registry = createActionRegistry();
const contracts = registry.contracts();

describe("staff AI tool manifest (SHO-322)", () => {
  it("includes documents.requestSign for documents:edit and hides signing internals", () => {
    const names = filterStaffAiTools(contracts, {
      role: "employee",
      permissions: ["documents:edit", "assistant:use"],
    }).map((contract) => contract.name);

    expect(names).toContain("documents.requestSign");
    expect(names).not.toContain("docSigning.start");
    expect(names).not.toContain("docSigning.complete");
    expect(names).not.toContain("assistant.getStaffActor");
    expect(names).not.toContain("assistant.recordAssistantTurn");
    expect(names).not.toContain("assistant.appendUserMessage");
    expect(names.some((name) => name.startsWith("docSigning."))).toBe(false);
    expect(
      contracts.some(
        (contract) =>
          contract.principal === "share" && names.includes(contract.name),
      ),
    ).toBe(false);
    expect(
      contracts.some(
        (contract) =>
          contract.principal === "system" && names.includes(contract.name),
      ),
    ).toBe(false);
  });

  it("lets an owner membership see documents.requestSign via staffHasPermission", () => {
    const names = filterStaffAiTools(contracts, {
      role: "owner",
      permissions: [],
    }).map((contract) => contract.name);
    expect(names).toContain("documents.requestSign");
    expect(names).toContain("orders.list");
    expect(names).toContain("orders.create");
    expect(names).toContain("customers.deleteCustomer");
    expect(names).not.toContain("docSigning.start");
    expect(names).not.toContain("docSigning.complete");
  });

  it("advertises Anthropic-safe ToolSet keys and still dispatches to orders.list", async () => {
    const execute = vi.fn(() =>
      Promise.resolve({ items: [], nextCursor: null }),
    );
    const filtered = filterStaffAiTools(contracts, {
      role: "owner",
      permissions: [],
    });
    const tools = staffAssistantTools(filtered, execute);
    const names = Object.keys(tools);
    expect(names.length).toBe(filtered.length);
    for (const name of names) {
      expect(name).toMatch(PROVIDER_TOOL_NAME_PATTERN);
      expect(name).not.toContain(".");
    }
    expect(names).toContain(toProviderToolName("orders.list"));
    expect(names).not.toContain("orders.list");
    await tools[toProviderToolName("orders.list")]?.execute?.(
      {},
      { toolCallId: "call-list", messages: [], context: undefined },
    );
    expect(execute).toHaveBeenCalledWith(
      "orders.list",
      {},
      { toolCallId: "call-list" },
    );
  });
});
