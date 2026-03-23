import { Command } from "commander";

import { clearTokens } from "../../auth/token.js";
import { resolveCommandContext } from "../../shared/context.js";

export function createAuthLogoutCommand(): Command {
  const logoutCommand = new Command("logout").description(
    "Clear authentication for the active profile",
  );

  logoutCommand.action(async () => {
    const context = await resolveCommandContext(logoutCommand);

    if (context.profile.length === 0) {
      context.formatter.output(
        { loggedIn: false, message: "No active session to log out from" },
        context.output,
      );
      return;
    }

    await clearTokens(context.profile);

    context.formatter.output(
      {
        loggedIn: false,
        profile: context.profile,
      },
      context.output,
    );
  });

  return logoutCommand;
}
