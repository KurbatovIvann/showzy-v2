/**
 * Composable admin replay command (fnd-T18). Packages never read
 * `process.env`; the eventual worker/admin entrypoint supplies validated
 * config, the DB client, logger, and `process.argv.slice(2)`.
 */
import type { Logger } from "pino";
import { z } from "zod";

import {
  replayDeadDeliveries,
  type DeliveryReplayDeps,
  type DeliveryReplayResult,
} from "./replay-dead-deliveries.js";

const consumerPattern = /^[a-z][a-zA-Z0-9]*\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export class DeliveryReplayCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryReplayCliError";
  }
}

export interface DeliveryReplayCliDeps extends DeliveryReplayDeps {
  readonly logger: Logger;
}

/**
 * Runs `replay-deliveries --consumer <stable-id> [--event-id <uuid>]`.
 * Requiring a consumer is the guard against an accidental global replay.
 */
export async function runDeliveryReplayCli(
  deps: DeliveryReplayCliDeps,
  argv: readonly string[],
): Promise<DeliveryReplayResult> {
  const options = parseDeliveryReplayArgs(argv);
  const result = await replayDeadDeliveries(deps, options);
  deps.logger.info(
    {
      consumer: options.consumer,
      event_id: options.eventId ?? null,
      replayed: result.replayed,
    },
    "dead event deliveries replayed",
  );
  return result;
}

export function parseDeliveryReplayArgs(argv: readonly string[]): {
  readonly consumer: string;
  readonly eventId?: string;
} {
  let consumer: string | undefined;
  let eventId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument !== "--consumer" && argument !== "--event-id") {
      throw new DeliveryReplayCliError(
        `unknown replay argument "${argument ?? ""}"`,
      );
    }
    if (value === undefined || value.startsWith("--")) {
      throw new DeliveryReplayCliError(`${argument} requires a value`);
    }

    if (argument === "--consumer") {
      if (consumer !== undefined) {
        throw new DeliveryReplayCliError("--consumer may be supplied once");
      }
      consumer = value;
    } else {
      if (eventId !== undefined) {
        throw new DeliveryReplayCliError("--event-id may be supplied once");
      }
      eventId = value;
    }
    index += 1;
  }

  if (consumer === undefined) {
    throw new DeliveryReplayCliError("--consumer is required");
  }
  if (!consumerPattern.test(consumer)) {
    throw new DeliveryReplayCliError(
      `consumer "${consumer}" must be a stable <module>.<kebab-name> id`,
    );
  }
  if (eventId !== undefined && !z.uuid().safeParse(eventId).success) {
    throw new DeliveryReplayCliError("--event-id must be a UUID");
  }

  return {
    consumer,
    ...(eventId === undefined ? {} : { eventId }),
  };
}
