import { Command } from "commander";

import { createFormatter, detectFormat } from "../output/index.js";

export function createVersionCommand(): Command {
  return new Command("version")
    .description("Show version information")
    .action(async (_options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<{ format?: string; json?: boolean }>();
      const formatter = createFormatter(detectFormat(globals.json ? "json" : globals.format));
      const root = command.parent ?? command;
      const version = root.version() ?? "unknown";

      formatter.output(
        {
          nodeVersion: process.version,
          platform: process.platform,
          version,
        },
        {},
      );
    });
}
