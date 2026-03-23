import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getOrganizations } from "../../../../src/api/auth.js";
import { authenticateWithRefreshToken } from "../../../../src/auth/device-flow.js";
import { getRefreshToken, storeTokens } from "../../../../src/auth/token.js";
import { createAuthSwitchCommand } from "../../../../src/commands/auth/switch.js";
import { setProfile } from "../../../../src/config/config.js";
import { AuthError } from "../../../../src/errors/index.js";
import type { Formatter, OutputContext } from "../../../../src/output/index.js";
import { resolveCommandContext } from "../../../../src/shared/context.js";
import { selectOrganization } from "../../../../src/shared/prompt.js";

vi.mock("../../../../src/shared/context.js", () => ({
  resolveCommandContext: vi.fn(),
}));

vi.mock("../../../../src/shared/prompt.js", () => ({
  selectOrganization: vi.fn(),
}));

vi.mock("../../../../src/api/auth.js", () => ({
  getOrganizations: vi.fn(),
}));

vi.mock("../../../../src/auth/device-flow.js", () => ({
  authenticateWithRefreshToken: vi.fn(),
}));

vi.mock("../../../../src/auth/token.js", () => ({
  getRefreshToken: vi.fn(),
  storeTokens: vi.fn(),
}));

vi.mock("../../../../src/config/config.js", () => ({
  setProfile: vi.fn(),
}));

function createMockFormatter(): Formatter {
  return {
    error: vi.fn(),
    list: vi.fn(),
    output: vi.fn(),
  };
}

function createMockClient() {
  return {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    requestJson: vi.fn(),
    requestResponse: vi.fn(),
    requestText: vi.fn(),
  };
}

function createMockContext(overrides: Record<string, unknown> = {}) {
  const formatter = createMockFormatter();
  const output: OutputContext = {};

  return {
    baseUrl: "https://api.example.com",
    client: createMockClient(),
    config: {
      active_profile: "ted",
      api_url: "https://api.example.com",
      client_id: "client_123",
      profiles: {
        ted: {
          auth_method: "oauth" as const,
          member_email: "ted@example.com",
          org_id: "org_old",
          org_name: "Old Org",
        },
      },
      version: 2,
    },
    env: {
      apiUrl: undefined,
      authApiUrl: undefined,
      forceColor: false,
      noColor: false,
      profile: undefined,
      token: undefined,
    },
    formatter,
    output,
    profile: "ted",
    ...overrides,
  };
}

async function runSwitchCommand(...extraArgs: string[]): Promise<void> {
  const root = new Command();
  root.name("talkvalue");
  root.addCommand(createAuthSwitchCommand());
  await root.parseAsync(["node", "test", "switch", ...extraArgs]);
}

describe("createAuthSwitchCommand", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-01T00:00:00.000Z"));
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("switch with argument — passes arg to selectOrganization, issues new token, updates profile", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext).mockResolvedValue(context as never);

    vi.mocked(getRefreshToken).mockResolvedValue("refresh_existing");

    vi.mocked(getOrganizations).mockResolvedValue([
      { id: "org_abc", name: "Acme Corp" },
      { id: "org_xyz", name: "Other Org" },
    ]);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_new",
      expires_in: 3600,
      id_token: "id_new",
      refresh_token: "refresh_new",
      token_type: "Bearer",
    });

    await runSwitchCommand("Acme Corp");

    // selectOrganization receives orgs and the argument
    expect(selectOrganization).toHaveBeenCalledWith(
      [
        { id: "org_abc", name: "Acme Corp" },
        { id: "org_xyz", name: "Other Org" },
      ],
      "Acme Corp",
    );

    // authenticateWithRefreshToken called with selected org
    expect(authenticateWithRefreshToken).toHaveBeenCalledWith({
      clientId: "client_123",
      refreshToken: "refresh_existing",
      organizationId: "org_abc",
    });

    // Tokens stored
    expect(storeTokens).toHaveBeenCalledWith("ted", {
      accessToken: "access_new",
      expiresAt: "2026-01-01T01:00:00.000Z",
      idToken: "id_new",
      refreshToken: "refresh_new",
    });

    // Profile updated
    expect(setProfile).toHaveBeenCalledWith("ted", {
      auth_method: "oauth",
      member_email: "ted@example.com",
      org_id: "org_abc",
      org_name: "Acme Corp",
    });

    // Output contains org info
    expect(context.formatter.output).toHaveBeenCalledWith(
      {
        orgId: "org_abc",
        orgName: "Acme Corp",
        profile: "ted",
      },
      context.output,
    );
  });

  it("throws AuthError when not logged in (empty profile)", async () => {
    const context = createMockContext({ profile: "" });
    vi.mocked(resolveCommandContext).mockResolvedValue(context as never);

    await expect(runSwitchCommand("Acme Corp")).rejects.toBeInstanceOf(AuthError);
    expect(getRefreshToken).not.toHaveBeenCalled();
  });

  it("throws AuthError when no refresh token", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext).mockResolvedValue(context as never);
    vi.mocked(getRefreshToken).mockResolvedValue(undefined);

    await expect(runSwitchCommand("Acme Corp")).rejects.toBeInstanceOf(AuthError);
    expect(getOrganizations).not.toHaveBeenCalled();
  });

  it("stores new tokens from authenticateWithRefreshToken", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext).mockResolvedValue(context as never);
    vi.mocked(getRefreshToken).mockResolvedValue("refresh_existing");

    vi.mocked(getOrganizations).mockResolvedValue([{ id: "org_abc", name: "Acme Corp" }]);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_switched",
      expires_in: 7200,
      id_token: "id_switched",
      refresh_token: "refresh_switched",
      token_type: "Bearer",
    });

    await runSwitchCommand();

    expect(storeTokens).toHaveBeenCalledWith("ted", {
      accessToken: "access_switched",
      expiresAt: "2026-01-01T02:00:00.000Z",
      idToken: "id_switched",
      refreshToken: "refresh_switched",
    });
  });

  it("falls back to existing refresh token when response has no refresh_token", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext).mockResolvedValue(context as never);
    vi.mocked(getRefreshToken).mockResolvedValue("refresh_existing");

    vi.mocked(getOrganizations).mockResolvedValue([{ id: "org_abc", name: "Acme Corp" }]);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_switched",
      expires_in: 3600,
      token_type: "Bearer",
    });

    await runSwitchCommand();

    expect(storeTokens).toHaveBeenCalledWith("ted", {
      accessToken: "access_switched",
      expiresAt: "2026-01-01T01:00:00.000Z",
      idToken: undefined,
      refreshToken: "refresh_existing",
    });
  });

  it("updates profile org_id and org_name via setProfile", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext).mockResolvedValue(context as never);
    vi.mocked(getRefreshToken).mockResolvedValue("refresh_existing");

    vi.mocked(getOrganizations).mockResolvedValue([{ id: "org_new", name: "New Org" }]);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_new",
      name: "New Org",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_new",
      expires_in: 3600,
      refresh_token: "refresh_new",
      token_type: "Bearer",
    });

    await runSwitchCommand();

    expect(setProfile).toHaveBeenCalledWith("ted", {
      auth_method: "oauth",
      member_email: "ted@example.com",
      org_id: "org_new",
      org_name: "New Org",
    });
  });

  it("passes authApiUrl override when env has it set", async () => {
    const context = createMockContext({
      env: {
        apiUrl: undefined,
        authApiUrl: "https://auth-override.example.com",
        forceColor: false,
        noColor: false,
        profile: undefined,
        token: undefined,
      },
    });
    vi.mocked(resolveCommandContext).mockResolvedValue(context as never);
    vi.mocked(getRefreshToken).mockResolvedValue("refresh_existing");

    vi.mocked(getOrganizations).mockResolvedValue([{ id: "org_abc", name: "Acme Corp" }]);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_new",
      expires_in: 3600,
      refresh_token: "refresh_new",
      token_type: "Bearer",
    });

    await runSwitchCommand();

    expect(authenticateWithRefreshToken).toHaveBeenCalledWith({
      clientId: "client_123",
      refreshToken: "refresh_existing",
      organizationId: "org_abc",
      apiBaseUrl: "https://auth-override.example.com",
    });
  });
});
