import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";

const target = process.argv[2];
if (target === undefined) {
  console.error("usage: assert-clean-path.mjs <repository-relative-path>");
  process.exitCode = 2;
} else {
  const result = spawnSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", target],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exitCode = result.status ?? 2;
  } else if (result.stdout.trim() !== "") {
    console.error(`generated drift detected in ${target}:\n${result.stdout}`);
    process.exitCode = 1;
  }
}
