/**
 * `apps/worker` process entry (fnd-T27 / fnd-T29). Config is parsed once; an
 * invalid environment crashes before anything claims work.
 */
import { createProcessLogger, loadServerConfig } from "@showzy/config";
import { runDeliveryReplayCli } from "@showzy/core";
import { createDbClient } from "@showzy/db";

import { bootWorker } from "./boot.js";
import { parseWorkerCommand } from "./command.js";
import { flushProcessObservability } from "./observability.js";
import { createProcessShutdown } from "./shutdown.js";

const command = parseWorkerCommand(process.argv.slice(2));
const config = loadServerConfig();

if (command.kind === "replay") {
  const logger = createProcessLogger({ name: "worker-replay" });
  const db = createDbClient({
    databaseUrl: config.database.url,
    onPoolError: (error) => {
      logger.error({ err: error }, "idle postgres pool client error");
    },
  });
  try {
    await runDeliveryReplayCli({ db: db.db, logger }, command.args);
  } finally {
    await db.pool.end();
  }
} else {
  // One process logger identity: boot creates it (with Sentry redaction)
  // and the entrypoint reuses it instead of constructing a second one.
  const booted = await bootWorker(config);
  const logger = booted.logger;
  logger.info({ worker_id: booted.loop.workerId }, "worker running");

  const shutdown = createProcessShutdown({
    logger,
    close: () => booted.close(),
    flush: () => flushProcessObservability(),
  });

  process.on("SIGINT", () => {
    void shutdown.run();
  });
  process.on("SIGTERM", () => {
    void shutdown.run();
  });
}
