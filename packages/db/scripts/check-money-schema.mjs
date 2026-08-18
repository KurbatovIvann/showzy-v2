import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import console from "node:console";
import process from "node:process";

const schemaRoot = path.resolve(process.argv[2] ?? "src/schema");
const moneyTerm =
  /(?:^|_)(?:price|amount|total|subtotal|discount|tax|fee|balance|refunded|payout|deposit|cost)(?:_|$)/i;
const nonMoneySuffix =
  /_(?:id|type|code|rate|bps|percent|percentage|treatment)$/i;
const columnPattern = /(\w+)\s*:\s*(\w+)\s*\(\s*["']([^"']+)["']/g;
const currencyPattern =
  /\w+\s*:\s*char\s*\(\s*["']currency["']\s*,\s*\{[\s\S]*?length\s*:\s*3[\s\S]*?\}\s*\)/;
const floatConstructors = new Set(["numeric", "doublePrecision", "real"]);

/**
 * Non-money decimal/float columns permitted in schema files.
 * Keys are `<relative-from-schema-root>:<sql_column_name>`. Empty until a
 * spec declares a legitimate non-money decimal (rates use `_bps`/`_percent`).
 */
const decimalAllowlist = new Set([
  // Example: "pricing.ts:display_ratio" — document why it is not money.
]);

function relativeSchemaPath(file) {
  return path.relative(schemaRoot, file).replaceAll("\\", "/");
}

function isDecimalAllowed(file, sqlName) {
  return decimalAllowlist.has(`${relativeSchemaPath(file)}:${sqlName}`);
}

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
    const columns = [...table.matchAll(columnPattern)];
    let needsCurrency = false;

    for (const column of columns) {
      const constructor = column[2];
      const sqlName = column[3] ?? "";
      const endsMinor = sqlName.endsWith("_minor");
      const endsMilli = sqlName.endsWith("_milli");
      const termMoney =
        moneyTerm.test(sqlName) && !nonMoneySuffix.test(sqlName);

      if (
        floatConstructors.has(constructor) &&
        !isDecimalAllowed(file, sqlName)
      ) {
        errors.push(
          `${file}: column "${sqlName}" uses ${constructor} — money/quantity must be bigint; other decimals must be allowlisted`,
        );
      }

      if (endsMinor || endsMilli) {
        if (constructor !== "bigint") {
          errors.push(
            `${file}: ${endsMinor ? "money" : "quantity"} column "${sqlName}" must use bigint`,
          );
        }
        if (endsMinor) {
          needsCurrency = true;
        }
        continue;
      }

      if (termMoney) {
        errors.push(`${file}: money column "${sqlName}" must end in _minor`);
        if (constructor !== "bigint") {
          errors.push(`${file}: money column "${sqlName}" must use bigint`);
        }
        needsCurrency = true;
      }
    }

    if (needsCurrency && !currencyPattern.test(table)) {
      errors.push(`${file}: money-bearing table must define currency char(3)`);
    }
  }
}

if (errors.length > 0) {
  console.error(`money schema check failed:\n${errors.join("\n")}`);
  process.exitCode = 1;
}
