import { Command } from "commander";
import updateNotifier from "update-notifier";

import { createAuthCommand } from "./commands/auth/index.js";
import { createConfigCommand } from "./commands/config/index.js";
import { createPathCommand } from "./commands/path/index.js";
import { PKG_NAME, createUpdateCommand } from "./commands/update.js";
import { createVersionCommand } from "./commands/version.js";
import { CliError } from "./errors/index.js";
import { createFormatter, detectFormat } from "./output/index.js";

declare const CLI_VERSION: string;

export function createProgram(): Command {
  return new Command()
    .name("talkvalue")
    .description("TalkValue CLI — manage your contacts and channels")
    .version(CLI_VERSION)
    .configureHelp({ showGlobalOptions: true })
    .option("--format <format>", "output format (json|table|csv)")
    .option("--json", "shorthand for --format json")
    .option("--profile <name>", "profile to use")
    .option("--api-url <url>", "API base URL override")
    .option("--no-color", "disable colored output")
    .addCommand(createAuthCommand())
    .addCommand(createPathCommand())
    .addCommand(createConfigCommand(), { hidden: true })
    .addCommand(createUpdateCommand())
    .addCommand(createVersionCommand());
}

function shouldSkipNotifier(argv: string[]): boolean {
  // Suppress the banner for JSON output (would mix with parsed data via 2>&1)
  // and on the update/version subcommands (their output already covers it).
  // update-notifier handles non-TTY, CI, NO_UPDATE_NOTIFIER, NODE_ENV=test internally.
  if (!process.stdout.isTTY) return true;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json" || arg === "--format=json") return true;
    if (arg === "--format" && argv[i + 1] === "json") return true;
    if (arg === "update" || arg === "version") return true;
  }
  return false;
}

function notifyOnUpdate(argv: string[]): void {
  if (shouldSkipNotifier(argv)) return;
  updateNotifier({
    pkg: { name: PKG_NAME, version: CLI_VERSION },
    updateCheckInterval: 1000 * 60 * 60 * 24,
  }).notify({ defer: true, isGlobal: true });
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();
  notifyOnUpdate(argv);

  process.on("SIGINT", () => {
    process.exitCode = 130;
    process.exit();
  });
  process.on("SIGTERM", () => {
    process.exitCode = 143;
    process.exit();
  });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    let formatter: ReturnType<typeof createFormatter>;
    try {
      const opts = program.opts<{ format?: string; json?: boolean }>();
      formatter = createFormatter(detectFormat(opts.json ? "json" : opts.format));
    } catch {
      formatter = createFormatter("json");
    }

    if (error instanceof CliError) {
      formatter.error(error, {});
      process.exitCode = error.exitCode;
      return;
    }

    const unknownError = error instanceof Error ? error : new Error("Unknown CLI error");
    formatter.error(unknownError, {});
    process.exitCode = 1;
  }
}

await main();
