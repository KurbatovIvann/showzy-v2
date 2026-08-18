/**
 * Process argv for the worker entry. Default (no args) runs the outbox
 * loop; `replay-deliveries` is the fnd-T18 admin command.
 */

export class WorkerCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerCommandError";
  }
}

export type WorkerCommand =
  | { readonly kind: "run" }
  | { readonly kind: "replay"; readonly args: readonly string[] };

export function parseWorkerCommand(argv: readonly string[]): WorkerCommand {
  const command = argv[0];
  if (command === undefined) {
    return { kind: "run" };
  }
  if (command === "replay-deliveries") {
    return { kind: "replay", args: argv.slice(1) };
  }
  throw new WorkerCommandError(
    `unknown worker command "${command}" (expected none or replay-deliveries)`,
  );
}
