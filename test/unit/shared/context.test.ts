import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/token.js", () => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
}));

vi.mock("../../../src/api/interceptors.js", () => ({
  configureClients: vi.fn(),
}));

import { getAccessToken } from "../../../src/auth/token.js";
import { AuthError } from "../../../src/errors/index.js";
import { type CommandContext, requireAuth } from "../../../src/shared/context.js";

function createContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    baseUrl: "https://api.example.com",
    config: {
      active_profile: "dev",
      api_url: "https://api.example.com",
      client_id: "client_123",
      profiles: {},
      version: 1,
    },
    env: {
      apiUrl: undefined,
      authApiUrl: undefined,
      forceColor: false,
      noColor: false,
      profile: undefined,
      token: undefined,
    },
    formatter: {} as CommandContext["formatter"],
    output: {
      command: "talkvalue path overview",
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    profile: "dev",
    ...overrides,
  };
}

describe("requireAuth", () => {
  it("allows env token auth without an active profile", async () => {
    await expect(
      requireAuth(
        createContext({
          env: {
            apiUrl: undefined,
            authApiUrl: undefined,
            forceColor: false,
            noColor: false,
            profile: undefined,
            token: "env-token",
          },
          profile: "",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("throws when no profile and no env token exist", async () => {
    await expect(requireAuth(createContext({ profile: "" }))).rejects.toBeInstanceOf(AuthError);
  });

  it("throws when stored token is missing", async () => {
    vi.mocked(getAccessToken).mockResolvedValueOnce(undefined);

    await expect(requireAuth(createContext())).rejects.toBeInstanceOf(AuthError);
  });

  it("passes when a stored token exists", async () => {
    vi.mocked(getAccessToken).mockResolvedValueOnce("stored-token");

    await expect(requireAuth(createContext())).resolves.toBeUndefined();
  });
});
