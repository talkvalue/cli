import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const credentialStore = new Map<string, string>();

vi.mock("../../../src/auth/keyring.js", () => {
  return {
    deleteCredential: vi.fn(async (account: string) => {
      credentialStore.delete(account);
    }),
    getCredential: vi.fn(async (account: string) => {
      return credentialStore.get(account);
    }),
    setCredential: vi.fn(async (account: string, value: string) => {
      credentialStore.set(account, value);
    }),
  };
});

function createJwtWithExp(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf8").toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("token manager", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    credentialStore.clear();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prefers TALKVALUE_TOKEN environment variable", async () => {
    const { getAccessToken, storeTokens } = await import("../../../src/auth/token.js");
    await storeTokens("dev", {
      accessToken: "stored-access-token",
      refreshToken: "stored-refresh-token",
    });

    process.env.TALKVALUE_TOKEN = "env-access-token";

    expect(await getAccessToken("dev")).toBe("env-access-token");
  });

  it("returns refresh token from persisted storage", async () => {
    const { getRefreshToken, storeTokens } = await import("../../../src/auth/token.js");

    await storeTokens("dev", {
      accessToken: "stored-access-token",
      refreshToken: "stored-refresh-token",
    });

    expect(await getRefreshToken("dev")).toBe("stored-refresh-token");
  });

  it("stores access, refresh, id, and expiresAt tokens under profile account keys", async () => {
    const { storeTokens } = await import("../../../src/auth/token.js");

    await storeTokens("dev", {
      accessToken: "stored-access-token",
      expiresAt: "2030-01-01T00:00:00.000Z",
      idToken: "stored-id-token",
      refreshToken: "stored-refresh-token",
    });

    expect(credentialStore).toEqual(
      new Map<string, string>([
        ["talkvalue:dev:access_token", "stored-access-token"],
        ["talkvalue:dev:expires_at", "2030-01-01T00:00:00.000Z"],
        ["talkvalue:dev:id_token", "stored-id-token"],
        ["talkvalue:dev:refresh_token", "stored-refresh-token"],
      ]),
    );
  });

  it("clears persisted token values for a profile", async () => {
    const { clearTokens, storeTokens } = await import("../../../src/auth/token.js");

    await storeTokens("dev", {
      accessToken: "stored-access-token",
      expiresAt: "2030-01-01T00:00:00.000Z",
      idToken: "stored-id-token",
      refreshToken: "stored-refresh-token",
    });

    await clearTokens("dev");

    expect(credentialStore.size).toBe(0);
  });

  it("marks tokens as expired with a 60-second safety buffer", async () => {
    const { isExpired } = await import("../../../src/auth/token.js");

    expect(isExpired(new Date(Date.now() + 50_000).toISOString())).toBe(true);
    expect(isExpired(new Date(Date.now() + 70_000).toISOString())).toBe(false);
  });

  it("marks tokens as needing refresh within five minutes", async () => {
    const { needsRefresh } = await import("../../../src/auth/token.js");

    expect(needsRefresh(new Date(Date.now() + 240_000).toISOString())).toBe(true);
    expect(needsRefresh(new Date(Date.now() + 360_000).toISOString())).toBe(false);
  });

  it("derives expires_at from JWT exp when access token is parseable", async () => {
    const { storeTokens } = await import("../../../src/auth/token.js");
    const expSeconds = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = createJwtWithExp(expSeconds);

    await storeTokens("dev", {
      accessToken,
      refreshToken: "stored-refresh-token",
    });

    expect(credentialStore.get("talkvalue:dev:expires_at")).toBe(
      new Date(expSeconds * 1000).toISOString(),
    );
  });

  it("uses explicit expiresAt when JWT exp cannot be parsed", async () => {
    const { storeTokens } = await import("../../../src/auth/token.js");
    const fallbackExpiry = "2035-05-05T00:00:00.000Z";

    await storeTokens("dev", {
      accessToken: "not-a-jwt",
      expiresAt: fallbackExpiry,
      refreshToken: "stored-refresh-token",
    });

    expect(credentialStore.get("talkvalue:dev:expires_at")).toBe(fallbackExpiry);
  });
});
