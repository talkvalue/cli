import { Command } from "commander";

import { Overview } from "../../api/generated/path/sdk.gen.js";
import type { PathOverviewRes, PathOverviewStatsRes } from "../../api/generated/path/types.gen.js";
import { unwrap } from "../../api/unwrap.js";
import { requireAuth, resolveCommandContext } from "../../shared/context.js";
import { parseNumericId } from "../../shared/utils.js";

function toRecord(data: PathOverviewRes | PathOverviewStatsRes): Record<string, unknown> {
  return { ...data };
}

export function createOverviewCommand(): Command {
  const overviewCommand = new Command("overview")
    .description("Show path overview")
    .option("--timezone <tz>", "timezone override")
    .option("--tag-id <id>", "filter by tag id", (v: string) => parseNumericId(v, "tag-id"));

  overviewCommand.action(
    async (options: { tagId?: number; timezone?: string }, command: Command) => {
      const context = await resolveCommandContext(command);
      await requireAuth(context);

      const { data } = await Overview.getOverview({
        query: { tagId: options.tagId, timeZone: options.timezone },
      });
      context.formatter.output(toRecord(unwrap(data, "overview")), context.output);
    },
  );

  overviewCommand
    .command("stats")
    .description("Show detailed path statistics")
    .action(async (_options: unknown, command: Command) => {
      const context = await resolveCommandContext(command);
      await requireAuth(context);

      const globals = command.optsWithGlobals<{ timezone?: string }>();
      const { data } = await Overview.getStats({
        query: { timeZone: globals.timezone },
      });
      context.formatter.output(toRecord(unwrap(data, "overview stats")), context.output);
    });

  return overviewCommand;
}
