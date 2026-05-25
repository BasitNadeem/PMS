/**
 * Adds @map("snake_case") to every camelCase field in schema.prisma.
 * Handles scalars, enums, and @db-annotated fields.
 * Run once: node scripts/add-field-maps.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "../packages/db/prisma/schema.prisma");

const toSnake = (s) => s.replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();

const SCALAR_TYPES = new Set([
  "String", "Int", "Float", "Boolean", "DateTime", "Decimal",
  "BigInt", "Bytes", "Json", "Unsupported",
]);

const schema = readFileSync(schemaPath, "utf8");

// Pass 1: collect all enum names defined in the schema
const enumNames = new Set();
for (const m of schema.matchAll(/^enum\s+(\w+)\s*\{/gm)) {
  enumNames.add(m[1]);
}

// Pass 2: add @map to camelCase fields that are scalars or enums
const lines = schema.split("\n");
let inModel = false;

const result = lines.map((line) => {
  if (/^model\s/.test(line))  { inModel = true;  return line; }
  if (/^enum\s/.test(line))   { inModel = false; return line; }
  if (line === "}")            { inModel = false; return line; }
  if (!inModel)                return line;

  // Must be a field definition: <indent> <fieldName> <rest>
  const m = line.match(/^(\s+)([a-zA-Z_][a-zA-Z0-9_]*)(\s+.+)$/);
  if (!m) return line;
  const [, indent, fieldName, rest] = m;

  // Skip @@directives
  if (fieldName.startsWith("@")) return line;
  // Already snake_case (no uppercase)
  if (!/[A-Z]/.test(fieldName)) return line;
  // @map already present
  if (rest.includes("@map(")) return line;
  // Relation fields (carry @relation) — virtual, no DB column
  if (rest.includes("@relation")) return line;

  // Determine the base type
  const typeToken = rest.trim().split(/\s/)[0].replace(/[?\[\]]/g, "");

  // Back-relation virtual fields: PascalCase model type, no @db, not an enum
  if (
    /^[A-Z]/.test(typeToken) &&
    !SCALAR_TYPES.has(typeToken) &&
    !enumNames.has(typeToken) &&
    !rest.includes("@db.")
  ) {
    return line; // virtual relation field — skip
  }

  const snakeName = toSnake(fieldName);
  const commentIdx = rest.indexOf("//");
  if (commentIdx !== -1) {
    const before  = rest.slice(0, commentIdx).trimEnd();
    const comment = rest.slice(commentIdx);
    return `${indent}${fieldName}${before} @map("${snakeName}") ${comment}`;
  }
  return `${indent}${fieldName}${rest.trimEnd()} @map("${snakeName}")`;
});

writeFileSync(schemaPath, result.join("\n"), "utf8");
console.log(`✅  @map annotations added (${enumNames.size} enums recognised).`);
