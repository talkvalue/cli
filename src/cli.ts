import { Command } from "commander";

import { createAuthCommand } from "./commands/auth/index.js";
import { createConfigCommand } from "./commands/config/index.js";
import { createPathCommand } from "./commands/path/index.js";
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
    .option("--profile <name>", "profile to use")
    .option("--api-url <url>", "API base URL override")
    .option("--no-color", "disable colored output")
    .option("--page <n>", "page number", Number.parseInt)
    .option("--page-size <n>", "page size", Number.parseInt)
    .addCommand(createAuthCommand())
    .addCommand(createPathCommand())
    .addCommand(createConfigCommand())
    .addCommand(createVersionCommand());
}

export async function main(argv = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const format = detectFormat(program.opts<{ format?: string }>().format);
    const formatter = createFormatter(format);
    const output = {};

    if (error instanceof CliError) {
      formatter.error(error, output);
      process.exitCode = error.exitCode;
      return;
    }

    const unknownError = error instanceof Error ? error : new Error("Unknown CLI error");
    formatter.error(unknownError, output);
    process.exitCode = 1;
  }
}

await main();
