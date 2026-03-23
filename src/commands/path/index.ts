import { Command } from "commander";

import { createChannelCommand } from "./channel.js";
import { createOverviewCommand } from "./overview.js";
import { createPersonCommand } from "./person.js";

export function createPathCommand(): Command {
  return new Command("path")
    .description("Path commands")
    .addCommand(createOverviewCommand())
    .addCommand(createPersonCommand())
    .addCommand(createChannelCommand());
}
