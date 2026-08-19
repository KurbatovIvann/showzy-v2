import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const specsDir = path.join(repoRoot, "docs", "specs");
const SKIP = new Set(["README.md", "template.md"]);

/**
 * @param {string} heading
 * @param {string} readme
 * @returns {string[]}
 */
function ledgerFiles(heading, readme) {
  const escaped = heading.replace(/[()]/g, "\\$&");
  const matched = readme.match(
    new RegExp(`### ${escaped}\\n([\\s\\S]*?)(?=\\n### |$)`),
  );
  assert.ok(matched, `docs/specs/README.md is missing ### ${heading}`);
  return [...matched[1].matchAll(/^- `([a-z0-9-]+\.md)`/gm)].map(
    (hit) => hit[1],
  );
}

/**
 * @param {string} text
 * @param {string} filename
 */
function parseHeader(text, filename) {
  const status = text.match(/^> Status: (Living|Active|Mixed)\b/m);
  assert.ok(
    status,
    `${filename}: missing "> Status: Living|Active|Mixed" in the header`,
  );
  const surface = text.match(/^> Active surface: (.+)$/m);
  assert.ok(surface, `${filename}: missing "> Active surface:" in the header`);
  const raw = surface[1].trim().toLowerCase();
  /** @type {"none" | "entire-file" | "slice"} */
  let kind;
  if (raw.startsWith("none")) {
    kind = "none";
  } else if (raw.startsWith("entire file")) {
    kind = "entire-file";
  } else {
    kind = "slice";
  }
  return { status: status[1], kind };
}

test("spec ledger matches Status and Active surface headers", () => {
  const readme = fs.readFileSync(path.join(specsDir, "README.md"), "utf8");
  const ledger = {
    active: ledgerFiles("Active (entire file)", readme),
    living: ledgerFiles("Living (Active surface: none)", readme),
    mixed: ledgerFiles("Mixed", readme),
  };

  const seen = new Set();
  for (const [bucket, files] of Object.entries(ledger)) {
    for (const file of files) {
      assert.ok(
        !seen.has(file),
        `${file} appears in more than one ledger list (${bucket})`,
      );
      seen.add(file);
      assert.ok(
        fs.existsSync(path.join(specsDir, file)),
        `ledger lists ${file} but the file is missing`,
      );
    }
  }

  const onDisk = fs
    .readdirSync(specsDir)
    .filter((name) => name.endsWith(".md") && !SKIP.has(name));

  for (const filename of onDisk) {
    assert.ok(
      seen.has(filename),
      `${filename} has no ledger row in docs/specs/README.md`,
    );
    const header = parseHeader(
      fs.readFileSync(path.join(specsDir, filename), "utf8"),
      filename,
    );
    if (ledger.active.includes(filename)) {
      assert.equal(header.status, "Active", `${filename} ledger: Active`);
      assert.equal(
        header.kind,
        "entire-file",
        `${filename} Active surface must start with "entire file"`,
      );
    } else if (ledger.living.includes(filename)) {
      assert.equal(header.status, "Living", `${filename} ledger: Living`);
      assert.equal(
        header.kind,
        "none",
        `${filename} Active surface must start with "none"`,
      );
    } else {
      assert.equal(header.status, "Mixed", `${filename} ledger: Mixed`);
      assert.equal(
        header.kind,
        "slice",
        `${filename} Mixed Active surface must name the slice, not none/entire file`,
      );
    }
  }
});
