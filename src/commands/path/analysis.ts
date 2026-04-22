import { Command } from "commander";

import { Analysis } from "../../api/generated/path/sdk.gen.js";
import { unwrap } from "../../api/unwrap.js";
import { UsageError } from "../../errors/index.js";
import type { Formatter } from "../../output/index.js";
import { ensureAuth, resolveFormatter } from "../../shared/context.js";
import { parseNumericId, toOutputContext, toOutputRecord } from "../../shared/utils.js";

export interface AnalysisCommandDependencies {
  formatter?: Formatter;
}

const collectNumericValues = (value: string, previous: number[]) => [
  ...previous,
  parseNumericId(value, "id"),
];

export function createAnalysisCommand(dependencies: AnalysisCommandDependencies = {}): Command {
  const command = new Command("analysis").description("Analysis commands for channels and events");

  const channelCommand = new Command("channel").description("Channel analysis commands");

  channelCommand
    .command("attribution")
    .description("Analyze channel-event attribution")
    .argument("<channelId>", "channel ID to analyze")
    .option("--event-id <id>", "event ID (repeatable)", collectNumericValues, [])
    .option("--tag-id <id>", "filter events by tag id", (v: string) => parseNumericId(v, "tag-id"))
    .action(
      async (
        rawChannelId: string,
        options: { eventId: number[]; tagId?: number },
        command: Command,
      ) => {
        const formatter = resolveFormatter(command, dependencies);
        await ensureAuth(command);
        const channelId = parseNumericId(rawChannelId, "channel ID");
        const { data } = await Analysis.getChannelEventContribution({
          path: { channelId },
          query: {
            ...(options.eventId.length > 0 ? { eventIds: options.eventId } : {}),
            ...(options.tagId !== undefined ? { tagId: options.tagId } : {}),
          },
        });
        formatter.output(toOutputRecord(unwrap(data, "result")), toOutputContext());
      },
    );

  channelCommand
    .command("audience")
    .description("Analyze channel audience overlap")
    .requiredOption(
      "--channel-id <id>",
      "channel ID (repeatable, min 2, max 5)",
      collectNumericValues,
      [],
    )
    .action(async (options: { channelId: number[] }, command: Command) => {
      if (options.channelId.length < 2 || options.channelId.length > 5) {
        throw new UsageError("--channel-id requires between 2 and 5 channel IDs");
      }

      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const { data } = await Analysis.getChannelOverlap({
        query: { channelIds: options.channelId },
      });
      formatter.output(toOutputRecord(unwrap(data, "result")), toOutputContext());
    });

  command.addCommand(channelCommand);

  const eventCommand = new Command("event").description("Event analysis commands");

  eventCommand
    .command("insights")
    .description("Get event insight signals")
    .option("--tag-id <id>", "filter events by tag id", (v: string) => parseNumericId(v, "tag-id"))
    .action(async (options: { tagId?: number }, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const { data } = await Analysis.getEventInsights({
        query: { tagId: options.tagId },
      });
      formatter.output(toOutputRecord(unwrap(data, "result")), toOutputContext());
    });

  eventCommand
    .command("trend")
    .description("Get event participant registration trend")
    .option("--tag-id <id>", "filter events by tag id", (v: string) => parseNumericId(v, "tag-id"))
    .action(async (options: { tagId?: number }, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const { data } = await Analysis.getEventParticipantTrend({
        query: { tagId: options.tagId },
      });
      formatter.output(toOutputRecord(unwrap(data, "result")), toOutputContext());
    });

  command.addCommand(eventCommand);

  return command;
}
