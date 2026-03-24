import { Command } from "commander";

import { clearTokens } from "../../auth/token.js";
import { deleteProfile } from "../../config/config.js";
import { resolveCommandContext } from "../../shared/context.js";

export function createAuthLogoutCommand(): Command {
  const logoutCommand = new Command("logout").description(
    "Remove authentication and profile for the active account",
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
    await deleteProfile(context.profile);

    context.formatter.output(
      {
        loggedOut: true,
        profile: context.profile,
      },
      context.output,
    );
  });

  return logoutCommand;
}
