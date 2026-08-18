import { describe, expect, it } from "vitest";

import { parseWorkerCommand, WorkerCommandError } from "./command.js";

describe("parseWorkerCommand", () => {
  it("runs the outbox loop when no args are given", () => {
    expect(parseWorkerCommand([])).toEqual({ kind: "run" });
  });

  it("routes replay-deliveries to the fnd-T18 CLI argv", () => {
    expect(
      parseWorkerCommand([
        "replay-deliveries",
        "--consumer",
        "chat.order-card-updater",
      ]),
    ).toEqual({
      kind: "replay",
      args: ["--consumer", "chat.order-card-updater"],
    });
  });

  it("rejects unknown commands", () => {
    expect(() => parseWorkerCommand(["migrate"])).toThrow(WorkerCommandError);
  });
});
