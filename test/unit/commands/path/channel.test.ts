import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../../../../src/api/client.js";
import type {
  ChannelRes,
  PersonDetailRes,
  PersonPageRes,
} from "../../../../src/api/generated/index.js";
import * as pathApi from "../../../../src/api/path.js";
import { createChannelCommand } from "../../../../src/commands/path/channel.js";
import { UsageError } from "../../../../src/errors/index.js";
import type { Formatter, OutputContext } from "../../../../src/output/index.js";

vi.mock("../../../../src/api/path.js", () => ({
  addPersonToChannel: vi.fn(),
  createChannel: vi.fn(),
  deleteChannel: vi.fn(),
  exportChannelPeople: vi.fn(),
  getChannel: vi.fn(),
  listChannelPeople: vi.fn(),
  listChannels: vi.fn(),
  updateChannel: vi.fn(),
}));

interface CommandHarness {
  client: ApiClient;
  formatter: Formatter;
  run: (argv: string[]) => Promise<void>;
  writeStdout: ReturnType<typeof vi.fn<(text: string) => void>>;
}

interface FormatterDouble extends Formatter {
  list: ReturnType<typeof vi.fn<Formatter["list"]>>;
  output: ReturnType<typeof vi.fn<Formatter["output"]>>;
  error: ReturnType<typeof vi.fn<Formatter["error"]>>;
}

function createClientStub(): ApiClient {
  return {
    delete: async <TResponse>(): Promise<TResponse> => {
      throw new Error("not implemented");
    },
    get: async <TResponse>(): Promise<TResponse> => {
      throw new Error("not implemented");
    },
    patch: async <TResponse>(): Promise<TResponse> => {
      throw new Error("not implemented");
    },
    post: async <TResponse>(): Promise<TResponse> => {
      throw new Error("not implemented");
    },
    put: async <TResponse>(): Promise<TResponse> => {
      throw new Error("not implemented");
    },
    requestJson: async <TResponse>(): Promise<TResponse> => {
      throw new Error("not implemented");
    },
    requestResponse: async (): Promise<Response> => {
      throw new Error("not implemented");
    },
    requestText: async (): Promise<string> => {
      throw new Error("not implemented");
    },
  };
}

function createFormatterDouble(): FormatterDouble {
  return {
    error: vi.fn<Formatter["error"]>(),
    list: vi.fn<Formatter["list"]>(),
    output: vi.fn<Formatter["output"]>(),
  };
}

function createHarness(): CommandHarness {
  const client = createClientStub();
  const formatter = createFormatterDouble();
  const writeStdout = vi.fn<(text: string) => void>();
  const command = createChannelCommand({
    client,
    formatter,
    writeStdout,
  });
  command.exitOverride();
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  return {
    client,
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
    vi.mocked(pathApi.listChannels).mockResolvedValueOnce(channels);

    await harness.run(["list"]);

    expect(pathApi.listChannels).toHaveBeenCalledWith(harness.client);
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("parses get id and forwards numeric value", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.getChannel).mockResolvedValueOnce({
      color: undefined,
      createdAt: "2026-01-01T00:00:00.000Z",
      icon: undefined,
      id: 42,
      name: "VIP",
      peopleCount: 3,
    });

    await harness.run(["get", "42"]);

    expect(pathApi.getChannel).toHaveBeenCalledWith(harness.client, 42);
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("requires --name for create", async () => {
    const harness = createHarness();

    await expect(harness.run(["create"])).rejects.toBeInstanceOf(UsageError);
    expect(pathApi.createChannel).not.toHaveBeenCalled();
  });

  it("forwards create payload", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.createChannel).mockResolvedValueOnce({
      color: "#123456",
      createdAt: "2026-01-01T00:00:00.000Z",
      icon: "hash",
      id: 2,
      name: "Partners",
      peopleCount: 0,
    });

    await harness.run(["create", "--name", "Partners", "--icon", "hash", "--color", "#123456"]);

    expect(pathApi.createChannel).toHaveBeenCalledWith(harness.client, {
      color: "#123456",
      icon: "hash",
      name: "Partners",
    });
  });

  it("requires --name for update", async () => {
    const harness = createHarness();

    await expect(harness.run(["update", "4", "--icon", "new-icon"])).rejects.toBeInstanceOf(
      UsageError,
    );
    expect(pathApi.updateChannel).not.toHaveBeenCalled();
  });

  it("forwards update payload", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.updateChannel).mockResolvedValueOnce({
      color: undefined,
      createdAt: "2026-01-01T00:00:00.000Z",
      icon: "new-icon",
      id: 4,
      name: "Team",
      peopleCount: 10,
    });

    await harness.run(["update", "4", "--name", "Team", "--icon", "new-icon"]);

    expect(pathApi.updateChannel).toHaveBeenCalledWith(harness.client, 4, {
      icon: "new-icon",
      name: "Team",
    });
  });

  it("throws UsageError when delete confirm is missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["delete", "9"])).rejects.toBeInstanceOf(UsageError);
    expect(pathApi.deleteChannel).not.toHaveBeenCalled();
  });

  it("deletes when --confirm is provided", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.deleteChannel).mockResolvedValueOnce(undefined);

    await harness.run(["delete", "9", "--confirm"]);

    expect(pathApi.deleteChannel).toHaveBeenCalledWith(harness.client, 9);
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
    vi.mocked(pathApi.listChannelPeople).mockResolvedValueOnce(people);

    await harness.run([
      "people",
      "9",
      "--keyword",
      "alice",
      "--page-number",
      "2",
      "--page-size",
      "30",
    ]);

    expect(pathApi.listChannelPeople).toHaveBeenCalledWith(harness.client, 9, {
      keyword: "alice",
      pageNumber: 2,
      pageSize: 30,
    });
  });

  it("requires --email for add-person", async () => {
    const harness = createHarness();

    await expect(harness.run(["add-person", "7"])).rejects.toBeInstanceOf(UsageError);
    expect(pathApi.addPersonToChannel).not.toHaveBeenCalled();
  });

  it("forwards add-person payload with supported fields", async () => {
    const harness = createHarness();
    const person = { id: 7 } as PersonDetailRes;
    vi.mocked(pathApi.addPersonToChannel).mockResolvedValueOnce(person);

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

    expect(pathApi.addPersonToChannel).toHaveBeenCalledWith(harness.client, 7, {
      companyName: "TalkValue",
      email: "jane@example.com",
      firstName: "Jane",
      joinedAt: "2026-01-01T00:00:00.000Z",
      phones: ["+1-111-111-1111", "+1-222-222-2222"],
    });
  });

  it("exports CSV via raw stdout writer", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.exportChannelPeople).mockResolvedValueOnce("id,name\n1,Alice\n");

    await harness.run(["export", "3"]);

    expect(pathApi.exportChannelPeople).toHaveBeenCalledWith(harness.client, 3);
    expect(harness.writeStdout).toHaveBeenCalledWith("id,name\n1,Alice\n");
    expect(harness.formatter.output).not.toHaveBeenCalled();
    expect(harness.formatter.list).not.toHaveBeenCalled();
  });
});
