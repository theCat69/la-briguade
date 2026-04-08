import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("la-briguade")
  .description("CLI for the la-briguade opencode plugin")
  .version(pkg.version);

program
  .command("install")
  .description("Add la-briguade to your opencode.json plugins list")
  .action(() => {
    // TODO: implement — read opencode.json, add plugin entry, write back
    console.log("install: not yet implemented");
  });

program
  .command("uninstall")
  .description("Remove la-briguade from your opencode.json plugins list")
  .action(() => {
    // TODO: implement — read opencode.json, remove plugin entry, write back
    console.log("uninstall: not yet implemented");
  });

program
  .command("doctor")
  .description("Verify la-briguade installation and diagnose issues")
  .action(() => {
    // TODO: implement — check opencode.json, verify content/ files, peer deps
    console.log("doctor: not yet implemented");
  });

program.parse();
