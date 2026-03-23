import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/device-flow.js", () => ({
  authenticateWithRefreshToken: vi.fn(),
}));

vi.mock("../../../src/auth/token.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/auth/token.js")>()),
  getRefreshToken: vi.fn(),
  storeTokens: vi.fn(),
}));

import { authenticateWithRefreshToken } from "../../../src/auth/device-flow.js";
import { createStoredTokenRefreshHandler } from "../../../src/auth/refresh.js";
import { getRefreshToken, storeTokens } from "../../../src/auth/token.js";

describe("createStoredTokenRefreshHandler", () => {
  it("refreshes and stores rotated tokens", async () => {
    vi.mocked(getRefreshToken).mockResolvedValueOnce("refresh_old");
    vi.mocked(authenticateWithRefreshToken).mockResolvedValueOnce({
      access_token: "access_new",
      expires_in: 3600,
      id_token: "id_new",
      refresh_token: "refresh_new",
    });

    const refreshed = await createStoredTokenRefreshHandler({
      authApiUrl: "https://auth-api.example.com",
      clientId: "client_123",
      env: {
        apiUrl: undefined,
        authApiUrl: "https://auth-api.example.com",
        forceColor: false,
        noColor: false,
        profile: undefined,
        token: undefined,
      },
      organizationId: "org_123",
      profile: "dev",
    })();

    expect(refreshed).toBe(true);
    expect(authenticateWithRefreshToken).toHaveBeenCalledWith({
      apiBaseUrl: "https://auth-api.example.com",
      clientId: "client_123",
      organizationId: "org_123",
      refreshToken: "refresh_old",
    });
    expect(storeTokens).toHaveBeenCalledWith(
      "dev",
      expect.objectContaining({
        accessToken: "access_new",
        idToken: "id_new",
        refreshToken: "refresh_new",
      }),
    );
  });

  it("returns false when env token is in use", async () => {
    const refreshed = await createStoredTokenRefreshHandler({
      clientId: "client_123",
      env: {
        apiUrl: undefined,
        authApiUrl: undefined,
        forceColor: false,
        noColor: false,
        profile: undefined,
        token: "env-token",
      },
      profile: "dev",
    })();

    expect(refreshed).toBe(false);
    expect(getRefreshToken).not.toHaveBeenCalled();
  });

  it("returns false when stored refresh token is missing", async () => {
    vi.mocked(getRefreshToken).mockResolvedValueOnce(undefined);

    const refreshed = await createStoredTokenRefreshHandler({
      clientId: "client_123",
      env: {
        apiUrl: undefined,
        authApiUrl: undefined,
        forceColor: false,
        noColor: false,
        profile: undefined,
        token: undefined,
      },
      profile: "dev",
    })();

    expect(refreshed).toBe(false);
    expect(authenticateWithRefreshToken).not.toHaveBeenCalled();
  });
});
