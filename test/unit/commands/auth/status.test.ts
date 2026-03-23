import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthOverview, getOrganizations } from "../../../../src/api/auth.js";
import { getAccessToken } from "../../../../src/auth/token.js";
import { createAuthStatusCommand } from "../../../../src/commands/auth/status.js";
import { setProfile } from "../../../../src/config/config.js";
import { AuthError } from "../../../../src/errors/index.js";
import type { Formatter } from "../../../../src/output/index.js";
import { resolveCommandContext } from "../../../../src/shared/context.js";

vi.mock("../../../../src/shared/context.js", () => ({
  resolveCommandContext: vi.fn(),
}));

vi.mock("../../../../src/auth/token.js", () => ({
  getAccessToken: vi.fn(),
}));

vi.mock("../../../../src/api/auth.js", () => ({
  getAuthOverview: vi.fn(),
  getOrganizations: vi.fn(),
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

async function runStatusCommand(): Promise<void> {
  const root = new Command();
  root.name("talkvalue");
  root.addCommand(createAuthStatusCommand());
  await root.parseAsync(["node", "test", "status"]);
}

describe("createAuthStatusCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("outputs logged-in status with profile and auth overview details", async () => {
    const formatter = createMockFormatter();
    const output = {};

    const client = {
      delete: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      requestJson: vi.fn(),
      requestResponse: vi.fn(),
      requestText: vi.fn(),
    };

    vi.mocked(resolveCommandContext).mockResolvedValue({
      baseUrl: "https://api.example.com",
      client,
      config: {
        active_profile: "dev",
        api_url: "https://api.example.com",
        client_id: "client_123",
        profiles: {
          dev: {
            auth_method: "oauth",
            member_email: "dev@example.com",
            org_id: "org_dev",
            org_name: "Dev Org",
          },
        },
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
      formatter,
      output,
      profile: "dev",
    });

    vi.mocked(getAccessToken).mockResolvedValue("access_123");
    vi.mocked(getAuthOverview).mockResolvedValue({
      memberFirstName: "Devin",
      teamMemberCount: 12,
    });

    await runStatusCommand();

    expect(getAccessToken).toHaveBeenCalledWith("dev");
    expect(getAuthOverview).toHaveBeenCalledWith(client);
    expect(formatter.output).toHaveBeenCalledWith(
      {
        profile: "dev",
        loggedIn: true,
        memberEmail: "dev@example.com",
        memberFirstName: "Devin",
        orgId: "org_dev",
        orgName: "Dev Org",
        teamMemberCount: 12,
      },
      output,
    );
  });

  it("outputs logged-out status and does not call auth overview", async () => {
    const formatter = createMockFormatter();

    vi.mocked(resolveCommandContext).mockResolvedValue({
      baseUrl: "https://api.example.com",
      client: {
        delete: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        requestJson: vi.fn(),
        requestResponse: vi.fn(),
        requestText: vi.fn(),
      },
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
      formatter,
      output: {},
      profile: "dev",
    });

    vi.mocked(getAccessToken).mockResolvedValue(undefined);

    await runStatusCommand();

    expect(getAuthOverview).not.toHaveBeenCalled();
    expect(formatter.output).toHaveBeenCalledWith(
      {
        profile: "dev",
        loggedIn: false,
      },
      expect.any(Object),
    );
  });

  it("marks the session logged out when the backend rejects the token", async () => {
    const formatter = createMockFormatter();

    vi.mocked(resolveCommandContext).mockResolvedValue({
      baseUrl: "https://api.example.com",
      client: {
        delete: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        requestJson: vi.fn(),
        requestResponse: vi.fn(),
        requestText: vi.fn(),
      },
      config: {
        active_profile: "dev",
        api_url: "https://api.example.com",
        client_id: "client_123",
        profiles: {
          dev: {
            auth_method: "oauth",
            member_email: "dev@example.com",
            org_id: "org_dev",
            org_name: "Dev Org",
          },
        },
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
      formatter,
      output: {},
      profile: "dev",
    });

    vi.mocked(getAccessToken).mockResolvedValue("access_123");
    vi.mocked(getAuthOverview).mockRejectedValue(new AuthError("Session expired"));

    await runStatusCommand();

    expect(formatter.output).toHaveBeenCalledWith(
      {
        profile: "dev",
        loggedIn: false,
        memberEmail: "dev@example.com",
        orgId: "org_dev",
        orgName: "Dev Org",
      },
      {},
    );
  });

  it("backfills orgName from API when empty in config", async () => {
    const formatter = createMockFormatter();
    const output = {};

    const client = {
      delete: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      requestJson: vi.fn(),
      requestResponse: vi.fn(),
      requestText: vi.fn(),
    };

    vi.mocked(resolveCommandContext).mockResolvedValue({
      baseUrl: "https://api.example.com",
      client,
      config: {
        active_profile: "dev",
        api_url: "https://api.example.com",
        client_id: "client_123",
        profiles: {
          dev: {
            auth_method: "oauth",
            member_email: "dev@example.com",
            org_id: "org_dev",
            org_name: "",
          },
        },
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
      formatter,
      output,
      profile: "dev",
    });

    vi.mocked(getAccessToken).mockResolvedValue("access_123");
    vi.mocked(getAuthOverview).mockResolvedValue({
      memberFirstName: "Devin",
      teamMemberCount: 12,
    });
    vi.mocked(getOrganizations).mockResolvedValue([
      { id: "org_dev", name: "Dev Org" },
      { id: "org_other", name: "Other Org" },
    ]);
    vi.mocked(setProfile).mockResolvedValue(undefined);

    await runStatusCommand();

    expect(getOrganizations).toHaveBeenCalledWith(client);
    expect(setProfile).toHaveBeenCalledWith("dev", {
      auth_method: "oauth",
      member_email: "dev@example.com",
      org_id: "org_dev",
      org_name: "Dev Org",
    });
    expect(formatter.output).toHaveBeenCalledWith(
      {
        profile: "dev",
        loggedIn: true,
        memberEmail: "dev@example.com",
        memberFirstName: "Devin",
        orgId: "org_dev",
        orgName: "Dev Org",
        teamMemberCount: 12,
      },
      output,
    );
  });
});
