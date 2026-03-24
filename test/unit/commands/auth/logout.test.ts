import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearTokens } from "../../../../src/auth/token.js";
import { createAuthLogoutCommand } from "../../../../src/commands/auth/logout.js";
import { deleteProfile } from "../../../../src/config/config.js";
import type { Formatter } from "../../../../src/output/index.js";
import { resolveCommandContext } from "../../../../src/shared/context.js";

vi.mock("../../../../src/shared/context.js", () => ({
  resolveCommandContext: vi.fn(),
}));

vi.mock("../../../../src/auth/token.js", () => ({
  clearTokens: vi.fn(),
}));

vi.mock("../../../../src/config/config.js", () => ({
  deleteProfile: vi.fn(),
}));

function createMockFormatter(): Formatter {
  return {
    error: vi.fn(),
    list: vi.fn(),
    output: vi.fn(),
  };
}

async function runLogoutCommand(): Promise<void> {
  const root = new Command();
  root.name("talkvalue");
  root.addCommand(createAuthLogoutCommand());
  await root.parseAsync(["node", "test", "logout"]);
}

describe("createAuthLogoutCommand", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("clears tokens for the active profile", async () => {
    const formatter = createMockFormatter();
    const output = {};

    vi.mocked(resolveCommandContext).mockResolvedValue({
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
      formatter,
      output,
      profile: "dev",
    });

    await runLogoutCommand();

    expect(clearTokens).toHaveBeenCalledWith("dev");
    expect(deleteProfile).toHaveBeenCalledWith("dev");
    expect(formatter.output).toHaveBeenCalledWith(
      {
        loggedOut: true,
        profile: "dev",
      },
      output,
    );
  });

  it("throws UsageError when there is no active profile", async () => {
    const formatter = createMockFormatter();

    vi.mocked(resolveCommandContext).mockResolvedValue({
      baseUrl: "https://api.example.com",
      config: {
        active_profile: "",
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
      profile: "",
    });

    await runLogoutCommand();
    expect(clearTokens).not.toHaveBeenCalled();
    expect(formatter.output).toHaveBeenCalledWith(
      { loggedIn: false, message: "No active session to log out from" },
      expect.any(Object),
    );
  });
});
