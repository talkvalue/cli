import type { Command } from "commander";

import { configureClients } from "../api/interceptors.js";
import { createStoredTokenRefreshHandler } from "../auth/refresh.js";
import { getAccessToken } from "../auth/token.js";
import { loadConfig } from "../config/config.js";
import { resolveEnv } from "../config/env.js";
import type { EnvConfig } from "../config/env.js";
import type { Config } from "../config/index.js";
import { AuthError } from "../errors/index.js";
import { createFormatter, detectFormat } from "../output/index.js";
import type { Formatter, OutputContext } from "../output/index.js";

interface CommandGlobalOptions {
  apiUrl?: string;
  format?: string;
  profile?: string;
}

export interface CommandContext {
  baseUrl: string;
  config: Config;
  env: EnvConfig;
  formatter: Formatter;
  output: OutputContext;
  profile: string;
}

function resolveProfile(
  commandOptions: CommandGlobalOptions,
  env: EnvConfig,
  config: Config,
): string {
  return commandOptions.profile ?? env.profile ?? config.active_profile;
}

function resolveBaseUrl(
  commandOptions: CommandGlobalOptions,
  env: EnvConfig,
  config: Config,
): string {
  return commandOptions.apiUrl ?? env.apiUrl ?? config.api_url;
}

function createOutputContext(): OutputContext {
  return {};
}

export async function resolveCommandContext(command: Command): Promise<CommandContext> {
  const config = await loadConfig();
  const env = resolveEnv();
  const commandOptions = command.optsWithGlobals<CommandGlobalOptions>();
  const profile = resolveProfile(commandOptions, env, config);
  const baseUrl = resolveBaseUrl(commandOptions, env, config);
  const formatter = createFormatter(detectFormat(commandOptions.format));

  configureClients({
    baseUrl,
    auth: async () => env.token ?? (profile ? await getAccessToken(profile) : undefined),
    onRefreshToken: profile
      ? createStoredTokenRefreshHandler({
          authApiUrl: env.authApiUrl,
          clientId: config.client_id,
          env,
          organizationId: config.profiles[profile]?.org_id,
          profile,
        })
      : undefined,
  });

  return {
    baseUrl,
    config,
    env,
    formatter,
    output: createOutputContext(),
    profile,
  };
}

export async function requireAuth(context: CommandContext): Promise<void> {
  if (context.env.token) {
    return;
  }

  if (context.profile.length === 0) {
    throw new AuthError("Not logged in. Run 'talkvalue auth login' to authenticate.");
  }

  const token = await getAccessToken(context.profile);

  if (!token) {
    throw new AuthError("Session expired. Run 'talkvalue auth login' to re-authenticate.");
  }
}
