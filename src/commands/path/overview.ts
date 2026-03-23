import { Command } from "commander";

import { Overview } from "../../api/generated/path/sdk.gen.js";
import type { PathOverviewRes, PathOverviewStatsRes } from "../../api/generated/path/types.gen.js";
import { unwrap } from "../../api/unwrap.js";
import { requireAuth, resolveCommandContext } from "../../shared/context.js";

function toRecord(data: PathOverviewRes | PathOverviewStatsRes): Record<string, unknown> {
  return { ...data };
}

export function createOverviewCommand(): Command {
  const overviewCommand = new Command("overview").description("Show path overview");

  overviewCommand.action(async (_options: unknown, command: Command) => {
    const context = await resolveCommandContext(command);
    await requireAuth(context);

    const { data } = await Overview.getOverview();
    context.formatter.output(toRecord(unwrap(data, "overview")), context.output);
  });

  overviewCommand
    .command("stats")
    .description("Show detailed path statistics")
    .option("--timezone <tz>", "timezone override")
    .action(async (options: { timezone?: string }, command: Command) => {
      const context = await resolveCommandContext(command);
      await requireAuth(context);

      const { data } = await Overview.getStats({
        query: { timeZone: options.timezone },
      });
      context.formatter.output(toRecord(unwrap(data, "overview stats")), context.output);
    });

  return overviewCommand;
}
