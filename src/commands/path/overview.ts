import { Command } from "commander";

import type { PathOverviewRes, PathOverviewStatsRes } from "../../api/generated/index.js";
import { getOverview, getOverviewStats } from "../../api/path.js";
import { requireAuth, resolveCommandContext } from "../../shared/context.js";

function toRecord(data: PathOverviewRes | PathOverviewStatsRes): Record<string, unknown> {
  return { ...data };
}

export function createOverviewCommand(): Command {
  const overviewCommand = new Command("overview").description("Show path overview");

  overviewCommand.action(async (_options: unknown, command: Command) => {
    const context = await resolveCommandContext(command);
    await requireAuth(context);

    const data = await getOverview(context.client);
    context.formatter.output(toRecord(data), context.output);
  });

  overviewCommand
    .command("stats")
    .description("Show detailed path statistics")
    .option("--timezone <tz>", "timezone override")
    .action(async (options: { timezone?: string }, command: Command) => {
      const context = await resolveCommandContext(command);
      await requireAuth(context);

      const data = await getOverviewStats(context.client, options.timezone);
      context.formatter.output(toRecord(data), context.output);
    });

  return overviewCommand;
}
