import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Organization } from "../../../../src/api/generated/auth/sdk.gen.js";
import {
  authenticateWithRefreshToken,
  openVerificationUri,
  pollForToken,
  requestDeviceCode,
} from "../../../../src/auth/device-flow.js";
import { decodeIdToken } from "../../../../src/auth/id-token.js";
import { storeTokens } from "../../../../src/auth/token.js";
import { createAuthLoginCommand } from "../../../../src/commands/auth/login.js";
import { createProfile } from "../../../../src/config/config.js";
import { AuthError } from "../../../../src/errors/cli-error.js";
import type { Formatter, OutputContext } from "../../../../src/output/index.js";
import { resolveCommandContext } from "../../../../src/shared/context.js";
import { selectOrganization } from "../../../../src/shared/prompt.js";

vi.mock("../../../../src/shared/context.js", () => ({
  resolveCommandContext: vi.fn(),
}));

vi.mock("../../../../src/auth/device-flow.js", () => ({
  authenticateWithRefreshToken: vi.fn(),
  openVerificationUri: vi.fn(),
  pollForToken: vi.fn(),
  requestDeviceCode: vi.fn(),
}));

vi.mock("../../../../src/auth/id-token.js", () => ({
  decodeIdToken: vi.fn(),
}));

vi.mock("../../../../src/auth/token.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/auth/token.js")>()),
  storeTokens: vi.fn(),
}));

vi.mock("../../../../src/config/config.js", () => ({
  createProfile: vi.fn(),
}));

vi.mock("../../../../src/api/generated/auth/sdk.gen.js", () => ({
  Organization: { getOrganizations: vi.fn() },
}));

vi.mock("../../../../src/shared/prompt.js", () => ({
  selectOrganization: vi.fn(),
}));

function createMockFormatter(): Formatter {
  return {
    error: vi.fn(),
    list: vi.fn(),
    output: vi.fn(),
  };
}

function createMockContext(overrides: Record<string, unknown> = {}) {
  const formatter = createMockFormatter();
  const output: OutputContext = {};

  return {
    baseUrl: "https://api.example.com",
    config: {
      active_profile: "",
      api_url: "https://api.example.com",
      client_id: "client_123",
      profiles: {},
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
    profile: "",
    ...overrides,
  };
}

async function runLoginCommand(...extraArgs: string[]): Promise<void> {
  const root = new Command();
  root.name("talkvalue");
  root.addCommand(createAuthLoginCommand());
  await root.parseAsync(["node", "test", "login", ...extraArgs]);
}

describe("createAuthLoginCommand", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-01T00:00:00.000Z"));
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  function setupDeviceFlow() {
    vi.mocked(requestDeviceCode).mockResolvedValue({
      device_code: "device_123",
      expires_in: 600,
      interval: 5,
      user_code: "ABCD-EFGH",
      verification_uri: "https://auth.example.com/activate",
      verification_uri_complete: "https://auth.example.com/activate?user_code=ABCD-EFGH",
    });

    vi.mocked(openVerificationUri).mockReturnValue(true);

    vi.mocked(pollForToken).mockResolvedValue({
      access_token: "access_initial",
      expires_in: 3600,
      id_token: "id_token_123",
      refresh_token: "refresh_123",
      token_type: "Bearer",
    });

    vi.mocked(decodeIdToken).mockReturnValue({
      email: "ted@example.com",
      org_id: undefined,
      org_name: undefined,
      sub: "user_123",
    });
  }

  it("login with single org — auto-selects, stores tokens, creates profile", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext)
      .mockResolvedValueOnce(context as never)
      .mockResolvedValueOnce(context as never);

    setupDeviceFlow();

    vi.mocked(Organization.getOrganizations).mockResolvedValue({
      data: { data: [{ id: "org_abc", name: "Acme Corp" }] },
    } as any);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_org_scoped",
      expires_in: 3600,
      id_token: "id_token_org",
      refresh_token: "refresh_org",
      token_type: "Bearer",
    });

    await runLoginCommand();

    // Initial tokens stored temporarily
    expect(storeTokens).toHaveBeenCalledWith("ted", {
      accessToken: "access_initial",
      expiresAt: "2026-01-01T01:00:00.000Z",
      idToken: "id_token_123",
      refreshToken: "refresh_123",
    });

    // Org list fetched via SDK
    expect(Organization.getOrganizations).toHaveBeenCalled();

    // selectOrganization called with orgs and no --org flag
    expect(selectOrganization).toHaveBeenCalledWith(
      [{ id: "org_abc", name: "Acme Corp" }],
      undefined,
    );

    // Re-auth with selected org
    expect(authenticateWithRefreshToken).toHaveBeenCalledWith({
      clientId: "client_123",
      refreshToken: "refresh_123",
      organizationId: "org_abc",
    });

    // Final org-scoped tokens stored
    expect(storeTokens).toHaveBeenCalledWith("ted", {
      accessToken: "access_org_scoped",
      expiresAt: "2026-01-01T01:00:00.000Z",
      idToken: "id_token_org",
      refreshToken: "refresh_org",
    });

    // Final profile created with org info
    expect(createProfile).toHaveBeenLastCalledWith("ted", {
      auth_method: "oauth",
      member_email: "ted@example.com",
      org_id: "org_abc",
      org_name: "Acme Corp",
    });

    // Output includes org info
    expect(context.formatter.output).toHaveBeenCalledWith(
      {
        email: "ted@example.com",
        loggedIn: true,
        orgId: "org_abc",
        orgName: "Acme Corp",
        profile: "ted",
      },
      context.output,
    );
  });

  it("login with --org flag — matches by name", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext)
      .mockResolvedValueOnce(context as never)
      .mockResolvedValueOnce(context as never);

    setupDeviceFlow();

    vi.mocked(Organization.getOrganizations).mockResolvedValue({
      data: {
        data: [
          { id: "org_abc", name: "Acme Corp" },
          { id: "org_xyz", name: "Other Org" },
        ],
      },
    } as any);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_org_scoped",
      expires_in: 3600,
      refresh_token: "refresh_org",
      token_type: "Bearer",
    });

    await runLoginCommand("--org", "Acme Corp");

    // selectOrganization receives the --org flag value
    expect(selectOrganization).toHaveBeenCalledWith(
      [
        { id: "org_abc", name: "Acme Corp" },
        { id: "org_xyz", name: "Other Org" },
      ],
      "Acme Corp",
    );
  });

  it("stores org-scoped tokens after re-auth with selected org", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext)
      .mockResolvedValueOnce(context as never)
      .mockResolvedValueOnce(context as never);

    setupDeviceFlow();

    vi.mocked(Organization.getOrganizations).mockResolvedValue({
      data: { data: [{ id: "org_abc", name: "Acme Corp" }] },
    } as any);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_final",
      expires_in: 7200,
      id_token: "id_final",
      refresh_token: "refresh_final",
      token_type: "Bearer",
    });

    await runLoginCommand();

    // Second call to storeTokens is the final org-scoped tokens
    const storeTokensCalls = vi.mocked(storeTokens).mock.calls;
    expect(storeTokensCalls).toHaveLength(2);

    // First call: initial tokens
    expect(storeTokensCalls[0]).toEqual([
      "ted",
      {
        accessToken: "access_initial",
        expiresAt: "2026-01-01T01:00:00.000Z",
        idToken: "id_token_123",
        refreshToken: "refresh_123",
      },
    ]);

    // Second call: org-scoped tokens
    expect(storeTokensCalls[1]).toEqual([
      "ted",
      {
        accessToken: "access_final",
        expiresAt: "2026-01-01T02:00:00.000Z",
        idToken: "id_final",
        refreshToken: "refresh_final",
      },
    ]);
  });

  it("profile name derived from email slug", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext)
      .mockResolvedValueOnce(context as never)
      .mockResolvedValueOnce(context as never);

    setupDeviceFlow();

    // Override email to have special characters
    vi.mocked(decodeIdToken).mockReturnValue({
      email: "Ted.Smith+dev@example.com",
      org_id: undefined,
      org_name: undefined,
      sub: "user_456",
    });

    vi.mocked(Organization.getOrganizations).mockResolvedValue({
      data: { data: [{ id: "org_abc", name: "Acme Corp" }] },
    } as any);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: "access_org",
      expires_in: 3600,
      refresh_token: "refresh_org",
      token_type: "Bearer",
    });

    await runLoginCommand();

    // Profile name is slugified email local part: "Ted.Smith+dev" -> "ted-smith-dev"
    expect(storeTokens).toHaveBeenCalledWith("ted-smith-dev", expect.any(Object));

    expect(createProfile).toHaveBeenLastCalledWith(
      "ted-smith-dev",
      expect.objectContaining({
        member_email: "Ted.Smith+dev@example.com",
      }),
    );
  });

  it("login with missing refresh_token in server response throws AuthError", async () => {
    const context = createMockContext();
    vi.mocked(resolveCommandContext)
      .mockResolvedValueOnce(context as never)
      .mockResolvedValueOnce(context as never);

    setupDeviceFlow();

    vi.mocked(pollForToken).mockResolvedValue({
      access_token: "access_initial",
      expires_in: 3600,
      id_token: "id_token_123",
      refresh_token: undefined,
      token_type: "Bearer",
    });

    vi.mocked(Organization.getOrganizations).mockResolvedValue({
      data: { data: [{ id: "org_abc", name: "Acme Corp" }] },
    } as any);

    vi.mocked(selectOrganization).mockResolvedValue({
      id: "org_abc",
      name: "Acme Corp",
    });

    let thrown: unknown;
    try {
      await runLoginCommand();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AuthError);
    expect((thrown as AuthError).message).toMatch(/please try logging in again/i);
  });
});
