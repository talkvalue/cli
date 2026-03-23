import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as pathApi from "../../../../src/api/path.js";
import { createPathCommand } from "../../../../src/commands/path/index.js";
import * as sharedModule from "../../../../src/shared/context.js";

vi.mock("../../../../src/shared/context.js");
vi.mock("../../../../src/api/path.js");

function createRoot(): Command {
  return new Command().option("--format <format>").addCommand(createPathCommand());
}

describe("path overview commands", () => {
  const mockFormatter = { error: vi.fn(), list: vi.fn(), output: vi.fn() };

  beforeEach(() => {
    vi.mocked(sharedModule.resolveCommandContext).mockResolvedValue({
      baseUrl: "https://api.example.com",
      client: { get: vi.fn() } as never,
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
        forceColor: false,
        noColor: false,
        profile: undefined,
        token: undefined,
      },
      formatter: mockFormatter,
      output: { command: "path overview", timestamp: "2026-01-01T00:00:00.000Z" },
      profile: "dev",
    });
    vi.mocked(sharedModule.requireAuth).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs overview", async () => {
    vi.mocked(pathApi.getOverview).mockResolvedValue({
      channelCount: 3,
      eventCount: 4,
      peopleCount: 5,
    });

    await createRoot().parseAsync(["node", "test", "--format", "json", "path", "overview"]);

    expect(sharedModule.requireAuth).toHaveBeenCalledTimes(1);
    expect(pathApi.getOverview).toHaveBeenCalledTimes(1);
    expect(mockFormatter.output).toHaveBeenCalledTimes(1);
  });

  it("forwards timezone to overview stats", async () => {
    vi.mocked(pathApi.getOverviewStats).mockResolvedValue({
      latestTrend: [],
      newPeopleThisMonth: 2,
      topChannels: [],
      totalChannels: 3,
      totalCompanies: 1,
      totalEvents: 4,
      totalPeople: 5,
    });

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

    expect(pathApi.getOverviewStats).toHaveBeenCalledWith(expect.anything(), "Asia/Seoul");
  });
});
