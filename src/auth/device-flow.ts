import { spawn } from "node:child_process";

import { DEFAULT_TIMEOUT_MS, POLL_TIMEOUT_MS } from "../api/constants.js";
import { AuthError } from "../errors/index.js";

const WORKOS_API_BASE = "https://api.workos.com";
const DEVICE_AUTH_PATH = "/user_management/authorize/device";
const TOKEN_PATH = "/user_management/authenticate";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const REFRESH_TOKEN_GRANT_TYPE = "refresh_token";
const JSON_CONTENT_TYPE = "application/json";
const FORM_URLENCODED = "application/x-www-form-urlencoded";
const SLOW_DOWN_SECONDS = 5;
const MAX_POLL_DURATION_MS = 15 * 60 * 1000;

interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  expires_in?: number;
  id_token?: string;
  organization_id?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  user?: {
    email?: string;
  };
}

interface OAuthErrorResponse {
  error: string;
  error_description?: string;
}

interface RequestDeviceCodeParams {
  apiBaseUrl?: string;
  clientId: string;
  scopes: readonly string[];
}

interface PollForTokenParams {
  apiBaseUrl?: string;
  clientId: string;
  deviceCode: string;
  expiresInSeconds?: number;
  intervalSeconds: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface RefreshTokenParams {
  apiBaseUrl?: string;
  clientId: string;
  organizationId?: string;
  refreshToken: string;
}

const sleepFor = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const getEndpoint = (baseUrl: string, pathname: string): string => {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${pathname}`;
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const isDeviceAuthorizationResponse = (value: unknown): value is DeviceAuthorizationResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.device_code === "string" &&
    typeof record.user_code === "string" &&
    typeof record.verification_uri === "string" &&
    typeof record.verification_uri_complete === "string" &&
    typeof record.expires_in === "number" &&
    typeof record.interval === "number"
  );
};

const isTokenResponse = (value: unknown): value is TokenResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.access_token === "string";
};

const parseOAuthError = (value: unknown): OAuthErrorResponse | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.error !== "string") {
    return undefined;
  }

  if ("error_description" in record && typeof record.error_description !== "string") {
    return undefined;
  }

  return {
    error: record.error,
    error_description:
      typeof record.error_description === "string" ? record.error_description : undefined,
  };
};

const errorMessageFor = (fallback: string, payload: OAuthErrorResponse | undefined): string => {
  if (!payload) {
    return fallback;
  }

  if (payload.error_description) {
    return payload.error_description;
  }

  return payload.error;
};

export const requestDeviceCode = async (
  params: RequestDeviceCodeParams,
): Promise<DeviceAuthorizationResponse> => {
  const base = params.apiBaseUrl ?? WORKOS_API_BASE;
  const response = await fetch(getEndpoint(base, DEVICE_AUTH_PATH), {
    body: new URLSearchParams({
      client_id: params.clientId,
      scope: params.scopes.join(" "),
    }),
    headers: {
      "content-type": FORM_URLENCODED,
    },
    method: "POST",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const payload = await parseJson(response);
  const oauthError = parseOAuthError(payload);

  if (!response.ok) {
    throw new AuthError(errorMessageFor("Failed to request device authorization", oauthError));
  }

  if (!isDeviceAuthorizationResponse(payload)) {
    throw new AuthError("Invalid device authorization response");
  }

  return payload;
};

export const pollForToken = async (params: PollForTokenParams): Promise<TokenResponse> => {
  const sleep = params.sleep ?? sleepFor;
  const base = params.apiBaseUrl ?? WORKOS_API_BASE;
  let intervalSeconds = params.intervalSeconds;
  const deadline =
    params.expiresInSeconds !== undefined
      ? Date.now() + params.expiresInSeconds * 1000
      : Date.now() + MAX_POLL_DURATION_MS;

  while (Date.now() < deadline) {
    const response = await fetch(getEndpoint(base, TOKEN_PATH), {
      body: new URLSearchParams({
        client_id: params.clientId,
        device_code: params.deviceCode,
        grant_type: DEVICE_GRANT_TYPE,
      }),
      headers: {
        "content-type": FORM_URLENCODED,
      },
      method: "POST",
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });

    const payload = await parseJson(response);
    if (response.ok) {
      if (!isTokenResponse(payload)) {
        throw new AuthError("Invalid token response");
      }

      return payload;
    }

    const oauthError = parseOAuthError(payload);
    const code = oauthError?.error;

    if (code === "authorization_pending") {
      await sleep(intervalSeconds * 1000);
      continue;
    }

    if (code === "slow_down") {
      intervalSeconds += SLOW_DOWN_SECONDS;
      await sleep(intervalSeconds * 1000);
      continue;
    }

    if (code === "expired_token") {
      throw new AuthError(errorMessageFor("Device code expired before authorization", oauthError));
    }

    throw new AuthError(errorMessageFor("Device authorization failed", oauthError));
  }

  throw new AuthError("Device code expired before authorization");
};

export const authenticateWithRefreshToken = async (
  params: RefreshTokenParams,
): Promise<TokenResponse> => {
  const base = params.apiBaseUrl ?? WORKOS_API_BASE;
  const response = await fetch(getEndpoint(base, TOKEN_PATH), {
    body: JSON.stringify({
      client_id: params.clientId,
      grant_type: REFRESH_TOKEN_GRANT_TYPE,
      ...(params.organizationId ? { organization_id: params.organizationId } : {}),
      refresh_token: params.refreshToken,
    }),
    headers: {
      "content-type": JSON_CONTENT_TYPE,
    },
    method: "POST",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const payload = await parseJson(response);
  const oauthError = parseOAuthError(payload);

  if (!response.ok) {
    throw new AuthError(errorMessageFor("Failed to refresh access token", oauthError));
  }

  if (!isTokenResponse(payload)) {
    throw new AuthError("Invalid refresh token response");
  }

  return payload;
};

export const openVerificationUri = (verificationUri: string): boolean => {
  if (process.env.TALKVALUE_DISABLE_BROWSER_OPEN === "1") {
    return false;
  }

  try {
    const child =
      process.platform === "darwin"
        ? spawn("open", [verificationUri], {
            detached: true,
            stdio: "ignore",
          })
        : process.platform === "win32"
          ? spawn("cmd", ["/c", "start", "", verificationUri], {
              detached: true,
              stdio: "ignore",
            })
          : spawn("xdg-open", [verificationUri], {
              detached: true,
              stdio: "ignore",
            });

    child.unref();
    return true;
  } catch {
    return false;
  }
};
