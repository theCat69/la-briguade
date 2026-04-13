/**
 * Generates schemas/la-briguade.schema.json from the Zod config schema.
 *
 * Run after build:
 *   npm run generate-schema
 *
 * The schema can then be referenced in la-briguade.json for IDE autocompletion:
 *   { "$schema": "./node_modules/la-briguade/schemas/la-briguade.schema.json" }
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

try {
  // Read package metadata (version for $id, name for title)
  const rawPkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf-8"));
  const version = rawPkg.version ?? "0.0.0";
  const pkgName = rawPkg.name ?? "la-briguade";

  // Import the pre-built schema object from the compiled output
  const { configJsonSchema } = await import("../dist/config/schema.js");

  const schema = {
    $id: `https://unpkg.com/${pkgName}@${version}/schemas/la-briguade.schema.json`,
    title: "la-briguade configuration",
    description:
      "Configuration file for the la-briguade opencode plugin. " +
      "Place as la-briguade.json or la-briguade.jsonc in your project root.",
    ...configJsonSchema,
  };

  const outDir = resolve(rootDir, "schemas");
  const outFile = resolve(outDir, "la-briguade.schema.json");

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(schema, null, 2) + "\n", "utf-8");

  console.log(`Generated: ${outFile}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[la-briguade] Failed to generate JSON schema: ${message}`);
  process.exit(1);
}
