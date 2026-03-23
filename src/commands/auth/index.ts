import { Command } from "commander";

import { createAuthListCommand } from "./list.js";
import { createAuthLoginCommand } from "./login.js";
import { createAuthLogoutCommand } from "./logout.js";
import { createAuthStatusCommand } from "./status.js";
import { createAuthSwitchCommand } from "./switch.js";

export function createAuthCommand(): Command {
  return new Command("auth")
    .description("Authentication commands")
    .addCommand(createAuthListCommand())
    .addCommand(createAuthLoginCommand())
    .addCommand(createAuthLogoutCommand())
    .addCommand(createAuthStatusCommand())
    .addCommand(createAuthSwitchCommand());
}

export { createAuthListCommand } from "./list.js";
export { createAuthLoginCommand } from "./login.js";
export { createAuthLogoutCommand } from "./logout.js";
export { createAuthStatusCommand } from "./status.js";
export { createAuthSwitchCommand } from "./switch.js";
