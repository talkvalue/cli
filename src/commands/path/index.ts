import { Command } from "commander";

import { createAnalysisCommand } from "./analysis.js";
import { createChannelCommand } from "./channel.js";
import { createCompanyCommand } from "./company.js";
import { createEventCommand } from "./event.js";
import { createImportCommand } from "./import.js";
import { createOverviewCommand } from "./overview.js";
import { createPersonCommand } from "./person.js";

export function createPathCommand(): Command {
  return new Command("path")
    .description("Path commands")
    .addCommand(createOverviewCommand())
    .addCommand(createPersonCommand())
    .addCommand(createChannelCommand())
    .addCommand(createEventCommand())
    .addCommand(createCompanyCommand())
    .addCommand(createAnalysisCommand())
    .addCommand(createImportCommand());
}
