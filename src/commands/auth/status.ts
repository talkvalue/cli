import { Command } from "commander";

import { getAuthOverview, getOrganizations } from "../../api/auth.js";
import { getAccessToken } from "../../auth/token.js";
import { setProfile } from "../../config/config.js";
import { AuthError, CliError } from "../../errors/index.js";
import { resolveCommandContext } from "../../shared/context.js";

function isAuthenticationFailure(error: unknown): boolean {
  if (error instanceof AuthError) {
    return true;
  }

  if (error instanceof CliError) {
    return /status (401|403)/.test(error.message);
  }

  return false;
}

export function createAuthStatusCommand(): Command {
  const statusCommand = new Command("status").description("Show authentication status");

  statusCommand.action(async () => {
    const context = await resolveCommandContext(statusCommand);
    const activeProfile = context.profile;

    if (activeProfile.length === 0) {
      context.formatter.output(
        {
          profile: null,
          loggedIn: false,
        },
        context.output,
      );
      return;
    }

    const profileConfig = context.config.profiles[activeProfile];
    const accessToken = await getAccessToken(activeProfile);
    let loggedIn = typeof accessToken === "string" && accessToken.length > 0;

    const payload: Record<string, unknown> = {
      profile: activeProfile,
      loggedIn,
      memberEmail: profileConfig?.member_email,
      orgId: profileConfig?.org_id,
      orgName: profileConfig?.org_name,
    };

    if (loggedIn) {
      try {
        const overview = await getAuthOverview(context.client);
        payload.memberFirstName = overview.memberFirstName;
        payload.teamMemberCount = overview.teamMemberCount;
      } catch (error) {
        if (isAuthenticationFailure(error)) {
          loggedIn = false;
          payload.loggedIn = false;
        }
      }

      // Backfill orgName if empty
      if (!profileConfig?.org_name && profileConfig) {
        try {
          const orgs = await getOrganizations(context.client);
          const currentOrg = orgs.find((o) => o.id === profileConfig.org_id);
          if (currentOrg) {
            await setProfile(activeProfile, {
              ...profileConfig,
              org_name: currentOrg.name,
            });
            payload.orgName = currentOrg.name;
          }
        } catch {
          // Best effort backfill, don't fail status
        }
      }
    }

    context.formatter.output(payload, context.output);
  });

  return statusCommand;
}
