/**
 * `apps/worker` process entry (fnd-T27). Config is parsed once; an invalid
 * environment crashes before anything claims work.
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
  const db = createDbClient({ databaseUrl: config.database.url });
  const logger = createProcessLogger({ name: "worker-replay" });
  try {
    await runDeliveryReplayCli({ db: db.db, logger }, command.args);
  } finally {
    await db.pool.end();
  }
} else {
  const logger = createProcessLogger({ name: "worker-boot" });
  const booted = await bootWorker(config);
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
