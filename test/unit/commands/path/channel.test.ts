import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Channel } from "../../../../src/api/generated/path/sdk.gen.js";
import type {
  ChannelRes,
  PersonDetailRes,
  PersonPageRes,
} from "../../../../src/api/generated/path/types.gen.js";
import { createChannelCommand } from "../../../../src/commands/path/channel.js";
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
  Channel: {
    listChannels: vi.fn(),
    createChannel: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    listChannelPeople: vi.fn(),
    createChannelPerson: vi.fn(),
    exportChannelPeopleCsv: vi.fn(),
  },
}));

interface CommandHarness {
  formatter: Formatter;
  run: (argv: string[]) => Promise<void>;
  writeStdout: ReturnType<typeof vi.fn<(text: string) => void>>;
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
  const writeStdout = vi.fn<(text: string) => void>();

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

  const command = createChannelCommand({
    formatter,
    writeStdout,
  });
  command.exitOverride();
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  return {
    formatter,
    run: async (argv: string[]): Promise<void> => {
      await program.parseAsync(["channel", ...argv], { from: "user" });
    },
    writeStdout,
  };
}

describe("createChannelCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses list and forwards to listChannels", async () => {
    const harness = createHarness();
    const channels: ChannelRes[] = [
      {
        color: "#ffffff",
        createdAt: "2026-01-01T00:00:00.000Z",
        icon: "chat",
        id: 1,
        name: "General",
        peopleCount: 25,
      },
    ];
    vi.mocked(Channel.listChannels).mockResolvedValueOnce({ data: channels } as any);

    await harness.run(["list"]);

    expect(Channel.listChannels).toHaveBeenCalled();
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("parses get id and forwards numeric value", async () => {
    const harness = createHarness();
    vi.mocked(Channel.listChannels).mockResolvedValueOnce({
      data: [
        {
          color: undefined,
          createdAt: "2026-01-01T00:00:00.000Z",
          icon: undefined,
          id: 42,
          name: "VIP",
          peopleCount: 3,
        },
      ],
    } as any);

    await harness.run(["get", "42"]);

    expect(Channel.listChannels).toHaveBeenCalled();
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("requires --name for create", async () => {
    const harness = createHarness();

    await expect(harness.run(["create"])).rejects.toBeInstanceOf(UsageError);
    expect(Channel.createChannel).not.toHaveBeenCalled();
  });

  it("forwards create payload", async () => {
    const harness = createHarness();
    vi.mocked(Channel.createChannel).mockResolvedValueOnce({
      data: {
        color: "#123456",
        createdAt: "2026-01-01T00:00:00.000Z",
        icon: "hash",
        id: 2,
        name: "Partners",
        peopleCount: 0,
      },
    } as any);

    await harness.run(["create", "--name", "Partners", "--icon", "hash", "--color", "#123456"]);

    expect(Channel.createChannel).toHaveBeenCalledWith({
      body: {
        color: "#123456",
        icon: "hash",
        name: "Partners",
      },
    });
  });

  it("requires --name for update (backend PUT semantics)", async () => {
    const harness = createHarness();

    // Commander's requiredOption surfaces a CommanderError, not a UsageError —
    // either way SDK must not be called.
    await expect(harness.run(["update", "4"])).rejects.toThrow();
    expect(Channel.updateChannel).not.toHaveBeenCalled();
  });

  it("requires --name even when only optional fields are provided", async () => {
    const harness = createHarness();

    await expect(harness.run(["update", "4", "--icon", "🔥"])).rejects.toThrow();
    expect(Channel.updateChannel).not.toHaveBeenCalled();
  });

  it("forwards update payload", async () => {
    const harness = createHarness();
    vi.mocked(Channel.updateChannel).mockResolvedValueOnce({
      data: {
        color: undefined,
        createdAt: "2026-01-01T00:00:00.000Z",
        icon: "new-icon",
        id: 4,
        name: "Team",
        peopleCount: 10,
      },
    } as any);

    await harness.run(["update", "4", "--name", "Team", "--icon", "new-icon"]);

    expect(Channel.updateChannel).toHaveBeenCalledWith({
      path: { id: 4 },
      body: {
        icon: "new-icon",
        name: "Team",
      },
    });
  });

  it("throws UsageError when delete confirm is missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["delete", "9"])).rejects.toBeInstanceOf(UsageError);
    expect(Channel.deleteChannel).not.toHaveBeenCalled();
  });

  it("deletes when --confirm is provided", async () => {
    const harness = createHarness();
    vi.mocked(Channel.deleteChannel).mockResolvedValueOnce({ data: undefined } as any);

    await harness.run(["delete", "9", "--confirm"]);

    expect(Channel.deleteChannel).toHaveBeenCalledWith({ path: { id: 9 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("forwards people filters for pagination and keyword", async () => {
    const harness = createHarness();
    const people: PersonPageRes = {
      content: [],
      pageNumber: 2,
      pageSize: 30,
      totalElements: 0,
      totalPages: 0,
    };
    vi.mocked(Channel.listChannelPeople).mockResolvedValueOnce({ data: people } as any);

    await harness.run(["people", "9", "--keyword", "alice", "--page", "2", "--page-size", "30"]);

    expect(Channel.listChannelPeople).toHaveBeenCalledWith({
      path: { channelId: 9 },
      query: {
        keyword: "alice",
        pageNumber: 2,
        pageSize: 30,
      },
    });
  });

  it("requires --email for add-person", async () => {
    const harness = createHarness();

    await expect(harness.run(["add-person", "7"])).rejects.toBeInstanceOf(UsageError);
    expect(Channel.createChannelPerson).not.toHaveBeenCalled();
  });

  it("forwards add-person payload with supported fields", async () => {
    const harness = createHarness();
    const person = { id: 7 } as PersonDetailRes;
    vi.mocked(Channel.createChannelPerson).mockResolvedValueOnce({ data: person } as any);

    await harness.run([
      "add-person",
      "7",
      "--email",
      "jane@example.com",
      "--first-name",
      "Jane",
      "--company-name",
      "TalkValue",
      "--phone",
      "+1-111-111-1111",
      "--phone",
      "+1-222-222-2222",
      "--joined-at",
      "2026-01-01T00:00:00.000Z",
    ]);

    expect(Channel.createChannelPerson).toHaveBeenCalledWith({
      path: { channelId: 7 },
      body: {
        companyName: "TalkValue",
        email: "jane@example.com",
        firstName: "Jane",
        joinedAt: "2026-01-01T00:00:00.000Z",
        phones: ["+1-111-111-1111", "+1-222-222-2222"],
      },
    });
  });

  it("exports CSV via raw stdout writer", async () => {
    const harness = createHarness();
    vi.mocked(Channel.exportChannelPeopleCsv).mockResolvedValueOnce({
      data: undefined,
      response: { text: async () => "id,name\n1,Alice\n" } as any,
    } as any);

    await harness.run(["export", "3"]);

    expect(Channel.exportChannelPeopleCsv).toHaveBeenCalledWith({
      path: { channelId: 3 },
      parseAs: "stream",
    });
    expect(harness.writeStdout).toHaveBeenCalledWith("id,name\n1,Alice\n");
    expect(harness.formatter.output).not.toHaveBeenCalled();
    expect(harness.formatter.list).not.toHaveBeenCalled();
  });
});
