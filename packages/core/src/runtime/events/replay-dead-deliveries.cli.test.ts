import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  DeliveryReplayCliError,
  parseDeliveryReplayArgs,
} from "./replay-dead-deliveries.cli.js";

describe("delivery replay admin CLI", () => {
  it("requires one consumer and accepts an optional event UUID", () => {
    const eventId = randomUUID();

    expect(
      parseDeliveryReplayArgs([
        "--consumer",
        "chat.order-card-updater",
        "--event-id",
        eventId,
      ]),
    ).toEqual({
      consumer: "chat.order-card-updater",
      eventId,
    });
    expect(
      parseDeliveryReplayArgs(["--consumer", "payments.order-payment-creator"]),
    ).toEqual({ consumer: "payments.order-payment-creator" });
  });

  it.each([
    [[], "--consumer is required"],
    [["--event-id", randomUUID()], "--consumer is required"],
    [["--consumer"], "--consumer requires a value"],
    [["--consumer", "chat.BAD_name"], "must be a stable"],
    [
      ["--consumer", "chat.order-card-updater", "--event-id", "not-a-uuid"],
      "--event-id must be a UUID",
    ],
    [
      ["--consumer", "chat.order-card-updater", "--all"],
      'unknown replay argument "--all"',
    ],
    [
      [
        "--consumer",
        "chat.order-card-updater",
        "--consumer",
        "payments.order-payment-creator",
      ],
      "--consumer may be supplied once",
    ],
  ])("rejects unsafe or malformed arguments: %j", (argv, message) => {
    expect(() => parseDeliveryReplayArgs(argv)).toThrow(DeliveryReplayCliError);
    expect(() => parseDeliveryReplayArgs(argv)).toThrow(message);
  });
});
