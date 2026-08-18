/**
 * `apps/api` process entry (fnd-T26). Config is parsed once; an invalid
 * environment crashes before anything listens.
 */
import { serve } from "@hono/node-server";
import { loadServerConfig } from "@showzy/config";
import { pino } from "pino";

import { bootApi } from "./boot.js";

const config = loadServerConfig();
const logger = pino({ name: "api-boot" });
const booted = await bootApi(config);

const server = serve(
  { fetch: booted.app.fetch, port: config.http.port },
  () => {
    logger.info({ port: config.http.port }, "api listening");
  },
);

async function shutdown(): Promise<void> {
  server.close();
  await booted.close();
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
