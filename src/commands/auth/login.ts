import chalk from "chalk";
import { Command } from "commander";

import { Organization } from "../../api/generated/auth/sdk.gen.js";
import {
  authenticateWithRefreshToken,
  openVerificationUri,
  pollForToken,
  requestDeviceCode,
} from "../../auth/device-flow.js";
import { decodeIdToken } from "../../auth/id-token.js";
import { resolveExpiry, storeTokens } from "../../auth/token.js";
import { createProfile } from "../../config/config.js";
import { AuthError } from "../../errors/cli-error.js";
import { resolveCommandContext } from "../../shared/context.js";
import { selectOrganization } from "../../shared/prompt.js";

const AUTH_SCOPES = ["openid", "profile", "email", "offline_access"] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveProfileName(email: string | undefined): string {
  if (email) return slugify(email.split("@")[0]);
  return "default";
}

function resolveEmail(
  claims: ReturnType<typeof decodeIdToken> | undefined,
  token: Awaited<ReturnType<typeof pollForToken>>,
): string | undefined {
  return claims?.email ?? token.user?.email;
}

export function createAuthLoginCommand(): Command {
  const loginCommand = new Command("login")
    .description("Authenticate with TalkValue")
    .option("--org <org>", "Organization name or ID");

  loginCommand.action(async () => {
    const context = await resolveCommandContext(loginCommand);
    const authApiOverride = context.env.authApiUrl;
    const orgFlag = loginCommand.opts().org as string | undefined;

    // 1. Device code flow
    const deviceCode = await requestDeviceCode({
      clientId: context.config.client_id,
      ...(authApiOverride ? { apiBaseUrl: authApiOverride } : {}),
      scopes: AUTH_SCOPES,
    });

    console.error("");
    console.error(
      `${chalk.yellow("!")} First copy your one-time code: ${chalk.bold(deviceCode.user_code)}`,
    );
    console.error(chalk.dim(`  Open ${deviceCode.verification_uri} in your browser`));
    console.error("");

    const browserOpened = openVerificationUri(deviceCode.verification_uri_complete);
    console.error(
      browserOpened
        ? chalk.dim("  Browser opened automatically.")
        : chalk.dim("  Could not open browser. Open the URL manually."),
    );
    console.error(chalk.dim("  Waiting for authentication..."));

    const token = await pollForToken({
      clientId: context.config.client_id,
      deviceCode: deviceCode.device_code,
      expiresInSeconds: deviceCode.expires_in,
      intervalSeconds: deviceCode.interval,
      ...(authApiOverride ? { apiBaseUrl: authApiOverride } : {}),
    });

    const claims = token.id_token ? decodeIdToken(token.id_token) : undefined;
    const email = resolveEmail(claims, token);

    // 2. Store initial tokens temporarily to make API calls
    const profileName = context.profile.length > 0 ? context.profile : deriveProfileName(email);

    const refreshToken = token.refresh_token || undefined;

    await storeTokens(profileName, {
      accessToken: token.access_token,
      expiresAt: resolveExpiry(token.expires_in),
      idToken: token.id_token,
      refreshToken,
    });

    await createProfile(profileName, {
      auth_method: "oauth",
      member_email: email ?? "",
      org_id: token.organization_id ?? "",
      org_name: "",
    });

    // 3. Org selection — re-resolve context so SDK clients pick up the new tokens
    await resolveCommandContext(loginCommand);
    const { data: orgList } = await Organization.getOrganizations();
    const organizations = orgList?.data ?? [];
    const selectedOrg = await selectOrganization(organizations, orgFlag);

    if (!refreshToken) {
      throw new AuthError("Server did not return a refresh token. Please try logging in again.");
    }

    // 4. Re-authenticate with selected org
    const orgToken = await authenticateWithRefreshToken({
      clientId: context.config.client_id,
      refreshToken,
      organizationId: selectedOrg.id,
      ...(authApiOverride ? { apiBaseUrl: authApiOverride } : {}),
    });

    // 5. Store final tokens and profile
    await storeTokens(profileName, {
      accessToken: orgToken.access_token,
      expiresAt: resolveExpiry(orgToken.expires_in),
      idToken: orgToken.id_token,
      refreshToken: orgToken.refresh_token || refreshToken,
    });

    await createProfile(profileName, {
      auth_method: "oauth",
      member_email: email ?? "",
      org_id: selectedOrg.id,
      org_name: selectedOrg.name,
    });

    console.error("");
    console.error(`${chalk.green("✓")} Logged in as ${email ?? profileName} (${selectedOrg.name})`);

    context.formatter.output(
      {
        email: email ?? profileName,
        loggedIn: true,
        orgId: selectedOrg.id,
        orgName: selectedOrg.name,
        profile: profileName,
      },
      context.output,
    );
  });

  return loginCommand;
}
