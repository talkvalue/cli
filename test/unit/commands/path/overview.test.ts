import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Overview } from "../../../../src/api/generated/path/sdk.gen.js";
import { createPathCommand } from "../../../../src/commands/path/index.js";
import { AuthError, CliError } from "../../../../src/errors/index.js";
import * as sharedModule from "../../../../src/shared/context.js";

vi.mock("../../../../src/shared/context.js");
vi.mock("../../../../src/api/generated/path/sdk.gen.js", () => ({
  Overview: {
    getOverview: vi.fn(),
    getStats: vi.fn(),
  },
}));

function createRoot(): Command {
  return new Command().option("--format <format>").addCommand(createPathCommand());
}

describe("path overview commands", () => {
  const mockFormatter = { error: vi.fn(), list: vi.fn(), output: vi.fn() };

  beforeEach(() => {
    vi.mocked(sharedModule.resolveCommandContext).mockResolvedValue({
      baseUrl: "https://api.example.com",
      config: {
        active_profile: "dev",
        api_url: "https://api.example.com",
        client_id: "client_123",
        profiles: {
          dev: {
            auth_method: "oauth" as const,
            member_email: "a@b.com",
            org_id: "org_1",
            org_name: "Dev",
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
      formatter: mockFormatter,
      output: {},
      profile: "dev",
    });
    vi.mocked(sharedModule.requireAuth).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs overview", async () => {
    vi.mocked(Overview.getOverview).mockResolvedValue({
      data: {
        channelCount: 3,
        eventCount: 4,
        peopleCount: 5,
      },
    } as any);

    await createRoot().parseAsync(["node", "test", "--format", "json", "path", "overview"]);

    expect(sharedModule.requireAuth).toHaveBeenCalledTimes(1);
    expect(Overview.getOverview).toHaveBeenCalledTimes(1);
    expect(mockFormatter.output).toHaveBeenCalledTimes(1);
  });

  it("requires auth before running overview", async () => {
    vi.mocked(sharedModule.requireAuth).mockRejectedValueOnce(new AuthError("missing token"));

    await expect(
      createRoot().parseAsync(["node", "test", "--format", "json", "path", "overview"]),
    ).rejects.toBeInstanceOf(AuthError);

    expect(sharedModule.requireAuth).toHaveBeenCalledTimes(1);
    expect(Overview.getOverview).not.toHaveBeenCalled();
    expect(mockFormatter.output).not.toHaveBeenCalled();
  });

  it("propagates api error from overview", async () => {
    vi.mocked(Overview.getOverview).mockRejectedValueOnce(new CliError("boom"));

    await expect(
      createRoot().parseAsync(["node", "test", "--format", "json", "path", "overview"]),
    ).rejects.toThrow("boom");

    expect(Overview.getOverview).toHaveBeenCalledTimes(1);
    expect(mockFormatter.output).not.toHaveBeenCalled();
  });

  it("throws when overview returns empty data", async () => {
    vi.mocked(Overview.getOverview).mockResolvedValue({
      data: undefined,
      error: { message: "no data" },
      request: new Request("https://api.example.com/path/overview"),
      response: new Response(),
    });

    await expect(
      createRoot().parseAsync(["node", "test", "--format", "json", "path", "overview"]),
    ).rejects.toThrow("No overview data returned");

    expect(Overview.getOverview).toHaveBeenCalledTimes(1);
    expect(mockFormatter.output).not.toHaveBeenCalled();
  });

  it("forwards timezone to overview stats", async () => {
    vi.mocked(Overview.getStats).mockResolvedValue({
      data: {
        latestTrend: [],
        newPeopleThisMonth: 2,
        topChannels: [],
        totalChannels: 3,
        totalCompanies: 1,
        totalEvents: 4,
        totalPeople: 5,
      },
    } as any);

    await createRoot().parseAsync([
      "node",
      "test",
      "--format",
      "json",
      "path",
      "overview",
      "stats",
      "--timezone",
      "Asia/Seoul",
    ]);

    expect(Overview.getStats).toHaveBeenCalledWith({
      query: { timeZone: "Asia/Seoul" },
    });
  });

  it("runs overview stats without timezone", async () => {
    vi.mocked(Overview.getStats).mockResolvedValue({
      data: {
        latestTrend: [],
        newPeopleThisMonth: 0,
        topChannels: [],
        totalChannels: 0,
        totalCompanies: 0,
        totalEvents: 0,
        totalPeople: 0,
      },
    } as any);

    await createRoot().parseAsync([
      "node",
      "test",
      "--format",
      "json",
      "path",
      "overview",
      "stats",
    ]);

    expect(sharedModule.requireAuth).toHaveBeenCalledTimes(1);
    expect(Overview.getStats).toHaveBeenCalledWith({ query: { timeZone: undefined } });
    expect(mockFormatter.output).toHaveBeenCalledTimes(1);
  });
});
