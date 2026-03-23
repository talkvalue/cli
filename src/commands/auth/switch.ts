import chalk from "chalk";
import { Command } from "commander";

import { getOrganizations } from "../../api/auth.js";
import { authenticateWithRefreshToken } from "../../auth/device-flow.js";
import { getRefreshToken, storeTokens } from "../../auth/token.js";
import { setProfile } from "../../config/config.js";
import { AuthError } from "../../errors/index.js";
import { resolveCommandContext } from "../../shared/context.js";
import { selectOrganization } from "../../shared/prompt.js";

function resolveExpiry(expiresInSeconds: number | undefined): string | undefined {
  if (expiresInSeconds === undefined) return undefined;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function createAuthSwitchCommand(): Command {
  const switchCommand = new Command("switch")
    .description("Switch active organization")
    .argument("[org]", "organization name or ID");

  switchCommand.action(async (orgArg: string | undefined) => {
    const context = await resolveCommandContext(switchCommand);
    const activeProfile = context.profile;

    if (activeProfile.length === 0) {
      throw new AuthError("Not logged in. Run `talkvalue auth login` first.");
    }

    const refreshToken = await getRefreshToken(activeProfile);
    if (!refreshToken) {
      throw new AuthError("No refresh token found. Run `talkvalue auth login` first.");
    }

    const organizations = await getOrganizations(context.client);
    const selectedOrg = await selectOrganization(organizations, orgArg);

    const authApiOverride = context.env.authApiUrl;
    const token = await authenticateWithRefreshToken({
      clientId: context.config.client_id,
      refreshToken,
      organizationId: selectedOrg.id,
      ...(authApiOverride ? { apiBaseUrl: authApiOverride } : {}),
    });

    await storeTokens(activeProfile, {
      accessToken: token.access_token,
      expiresAt: resolveExpiry(token.expires_in),
      idToken: token.id_token,
      refreshToken: token.refresh_token ?? refreshToken,
    });

    const profileConfig = context.config.profiles[activeProfile];
    if (profileConfig) {
      await setProfile(activeProfile, {
        ...profileConfig,
        org_id: selectedOrg.id,
        org_name: selectedOrg.name,
      });
    }

    console.error(`${chalk.green("\u2713")} Switched to ${selectedOrg.name}`);

    context.formatter.output(
      {
        orgId: selectedOrg.id,
        orgName: selectedOrg.name,
        profile: activeProfile,
      },
      context.output,
    );
  });

  return switchCommand;
}
