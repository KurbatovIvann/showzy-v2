import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import console from "node:console";
import process from "node:process";

const schemaRoot = path.resolve(process.argv[2] ?? "src/schema");
const moneyTerm =
  /(?:^|_)(?:price|amount|total|subtotal|discount|tax|fee|balance)(?:_|$)/i;
const nonMoneySuffix =
  /_(?:id|type|code|rate|bps|percent|percentage|treatment)$/i;
const columnPattern =
  /(\w+)\s*:\s*(\w+)\s*\(\s*["']([^"']+)["']/g;
const currencyPattern =
  /\w+\s*:\s*char\s*\(\s*["']currency["']\s*,\s*\{[\s\S]*?length\s*:\s*3[\s\S]*?\}\s*\)/;

async function collectTypeScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(absolute)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(absolute);
    }
  }
  return files;
}

const errors = [];
for (const file of await collectTypeScriptFiles(schemaRoot)) {
  const source = await readFile(file, "utf8");
  const tables = source
    .split(/(?=export const \w+\s*=\s*pgTable\s*\()/)
    .filter((block) => block.includes("pgTable("));

  for (const table of tables) {
    const columns = [...table.matchAll(columnPattern)].filter((match) => {
      const sqlName = match[3] ?? "";
      return moneyTerm.test(sqlName) && !nonMoneySuffix.test(sqlName);
    });
    for (const column of columns) {
      const constructor = column[2];
      const sqlName = column[3] ?? "";
      if (!sqlName.endsWith("_minor")) {
        errors.push(`${file}: money column "${sqlName}" must end in _minor`);
      }
      if (constructor !== "bigint") {
        errors.push(`${file}: money column "${sqlName}" must use bigint`);
      }
    }
    if (columns.length > 0 && !currencyPattern.test(table)) {
      errors.push(`${file}: money-bearing table must define currency char(3)`);
    }
  }
}

if (errors.length > 0) {
  console.error(`money schema check failed:\n${errors.join("\n")}`);
  process.exitCode = 1;
}
