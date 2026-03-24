import { resolveEnv } from "../config/env.js";

import { decodeJwtPayload } from "./jwt.js";
import { deleteCredential, getCredential, setCredential } from "./keyring.js";

const ACCESS_TOKEN_KEY = "access_token";
const EXPIRES_AT_KEY = "expires_at";
const ID_TOKEN_KEY = "id_token";
const REFRESH_TOKEN_KEY = "refresh_token";

const EXPIRED_BUFFER_MS = 60_000;
const REFRESH_WINDOW_MS = 300_000;

export interface StoredTokens {
  accessToken: string;
  expiresAt?: string;
  idToken?: string;
  refreshToken: string | undefined;
}

function createAccountKey(profile: string, key: string): string {
  return `talkvalue:${profile}:${key}`;
}

function parseExpiryFromJwt(accessToken: string): string | undefined {
  const payload = decodeJwtPayload(accessToken);

  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const exp = (payload as Record<string, unknown>).exp;

  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return undefined;
  }

  return new Date(exp * 1000).toISOString();
}

function parseTime(expiresAt: string | undefined): number | undefined {
  if (!expiresAt) {
    return undefined;
  }

  const timestamp = Date.parse(expiresAt);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return timestamp;
}

async function setOptionalCredential(account: string, value: string | undefined): Promise<void> {
  if (value === undefined) {
    await deleteCredential(account);
    return;
  }

  await setCredential(account, value);
}

export async function getAccessToken(profile: string): Promise<string | undefined> {
  const env = resolveEnv();

  if (env.token !== undefined) {
    return env.token;
  }

  return getCredential(createAccountKey(profile, ACCESS_TOKEN_KEY));
}

export async function getRefreshToken(profile: string): Promise<string | undefined> {
  return getCredential(createAccountKey(profile, REFRESH_TOKEN_KEY));
}

export async function storeTokens(profile: string, tokens: StoredTokens): Promise<void> {
  const expiresAt = parseExpiryFromJwt(tokens.accessToken) ?? tokens.expiresAt;

  await setCredential(createAccountKey(profile, ACCESS_TOKEN_KEY), tokens.accessToken);
  await setOptionalCredential(
    createAccountKey(profile, REFRESH_TOKEN_KEY),
    tokens.refreshToken || undefined,
  );
  await setOptionalCredential(createAccountKey(profile, ID_TOKEN_KEY), tokens.idToken);
  await setOptionalCredential(createAccountKey(profile, EXPIRES_AT_KEY), expiresAt);
}

export async function clearTokens(profile: string): Promise<void> {
  await deleteCredential(createAccountKey(profile, ACCESS_TOKEN_KEY));
  await deleteCredential(createAccountKey(profile, REFRESH_TOKEN_KEY));
  await deleteCredential(createAccountKey(profile, ID_TOKEN_KEY));
  await deleteCredential(createAccountKey(profile, EXPIRES_AT_KEY));
}

export function isExpired(expiresAt: string | undefined): boolean {
  const timestamp = parseTime(expiresAt);

  if (timestamp === undefined) {
    return true;
  }

  return timestamp <= Date.now() + EXPIRED_BUFFER_MS;
}

export function needsRefresh(expiresAt: string | undefined): boolean {
  const timestamp = parseTime(expiresAt);

  if (timestamp === undefined) {
    return true;
  }

  return timestamp <= Date.now() + REFRESH_WINDOW_MS;
}

export function resolveExpiry(expiresInSeconds: number | undefined): string | undefined {
  if (expiresInSeconds === undefined) return undefined;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
