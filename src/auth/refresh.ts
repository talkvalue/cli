import type { EnvConfig } from "../config/env.js";

import { authenticateWithRefreshToken } from "./device-flow.js";
import { getRefreshToken, storeTokens } from "./token.js";

interface RefreshHandlerOptions {
  authApiUrl?: string;
  clientId: string;
  env: EnvConfig;
  organizationId?: string;
  profile: string;
}

function resolveExpiry(expiresInSeconds: number | undefined): string | undefined {
  if (expiresInSeconds === undefined) {
    return undefined;
  }

  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function createStoredTokenRefreshHandler(
  options: RefreshHandlerOptions,
): () => Promise<boolean> {
  return async (): Promise<boolean> => {
    if (options.env.token || options.profile.length === 0) {
      return false;
    }

    const currentRefreshToken = await getRefreshToken(options.profile);

    if (!currentRefreshToken) {
      return false;
    }

    const refreshed = await authenticateWithRefreshToken({
      ...(options.authApiUrl ? { apiBaseUrl: options.authApiUrl } : {}),
      clientId: options.clientId,
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      refreshToken: currentRefreshToken,
    });

    await storeTokens(options.profile, {
      accessToken: refreshed.access_token,
      expiresAt: resolveExpiry(refreshed.expires_in),
      idToken: refreshed.id_token,
      refreshToken: refreshed.refresh_token ?? currentRefreshToken,
    });

    return true;
  };
}
