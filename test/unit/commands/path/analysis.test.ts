import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Analysis } from "../../../../src/api/generated/path/sdk.gen.js";
import { createAnalysisCommand } from "../../../../src/commands/path/analysis.js";
import { UsageError } from "../../../../src/errors/index.js";
import type { Formatter, OutputContext } from "../../../../src/output/index.js";
import * as sharedModule from "../../../../src/shared/context.js";

vi.mock("../../../../src/shared/context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/shared/context.js")>();
  return {
    ...actual,
    resolveCommandContext: vi.fn(),
    requireAuth: vi.fn(),
    ensureAuth: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../../../src/api/generated/path/sdk.gen.js", () => ({
  Analysis: {
    getChannelEventContribution: vi.fn(),
    getChannelOverlap: vi.fn(),
    getEventInsights: vi.fn(),
    getEventParticipantTrend: vi.fn(),
  },
}));

interface CommandHarness {
  formatter: Formatter;
  run: (argv: string[]) => Promise<void>;
}

interface FormatterDouble extends Formatter {
  list: ReturnType<typeof vi.fn<Formatter["list"]>>;
  output: ReturnType<typeof vi.fn<Formatter["output"]>>;
  error: ReturnType<typeof vi.fn<Formatter["error"]>>;
}

function createFormatterDouble(): FormatterDouble {
  return {
    error: vi.fn<Formatter["error"]>(),
    list: vi.fn<Formatter["list"]>(),
    output: vi.fn<Formatter["output"]>(),
  };
}

function createHarness(): CommandHarness {
  const formatter = createFormatterDouble();

  vi.mocked(sharedModule.resolveCommandContext).mockResolvedValue({
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
      token: "test-token",
    },
    formatter,
    output: {},
    profile: "dev",
  });
  vi.mocked(sharedModule.requireAuth).mockResolvedValue(undefined);

  const command = createAnalysisCommand({ formatter });
  command.exitOverride();
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  return {
    formatter,
    run: async (argv: string[]): Promise<void> => {
      await program.parseAsync(["analysis", ...argv], { from: "user" });
    },
  };
}

describe("createAnalysisCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("channel attribution requires --event-id", async () => {
    const harness = createHarness();

    await expect(harness.run(["channel", "attribution", "1"])).rejects.toBeInstanceOf(UsageError);
    expect(Analysis.getChannelEventContribution).not.toHaveBeenCalled();
  });

  it("channel attribution calls SDK with channelId and eventIds", async () => {
    const harness = createHarness();
    vi.mocked(Analysis.getChannelEventContribution).mockResolvedValueOnce({
      data: { channelId: 5, contributions: [] },
    } as any);

    await harness.run(["channel", "attribution", "5", "--event-id", "10", "--event-id", "20"]);

    expect(Analysis.getChannelEventContribution).toHaveBeenCalledWith({
      path: { channelId: 5 },
      query: { eventIds: [10, 20] },
    });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("channel audience requires 2-5 --channel-id values", async () => {
    const harness = createHarness();

    await expect(harness.run(["channel", "audience", "--channel-id", "1"])).rejects.toBeInstanceOf(
      UsageError,
    );
    expect(Analysis.getChannelOverlap).not.toHaveBeenCalled();
  });

  it("channel audience rejects more than 5 --channel-id values", async () => {
    const harness = createHarness();

    await expect(
      harness.run([
        "channel",
        "audience",
        "--channel-id",
        "1",
        "--channel-id",
        "2",
        "--channel-id",
        "3",
        "--channel-id",
        "4",
        "--channel-id",
        "5",
        "--channel-id",
        "6",
      ]),
    ).rejects.toBeInstanceOf(UsageError);
    expect(Analysis.getChannelOverlap).not.toHaveBeenCalled();
  });

  it("channel audience calls SDK with valid channel IDs", async () => {
    const harness = createHarness();
    vi.mocked(Analysis.getChannelOverlap).mockResolvedValueOnce({
      data: { overlaps: [] },
    } as any);

    await harness.run(["channel", "audience", "--channel-id", "1", "--channel-id", "2"]);

    expect(Analysis.getChannelOverlap).toHaveBeenCalledWith({
      query: { channelIds: [1, 2] },
    });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("event insights calls SDK with no params", async () => {
    const harness = createHarness();
    vi.mocked(Analysis.getEventInsights).mockResolvedValueOnce({
      data: { signals: [] },
    } as any);

    await harness.run(["event", "insights"]);

    expect(Analysis.getEventInsights).toHaveBeenCalledWith();
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("event trend calls SDK with no params", async () => {
    const harness = createHarness();
    vi.mocked(Analysis.getEventParticipantTrend).mockResolvedValueOnce({
      data: { trend: [] },
    } as any);

    await harness.run(["event", "trend"]);

    expect(Analysis.getEventParticipantTrend).toHaveBeenCalledWith();
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });
});
