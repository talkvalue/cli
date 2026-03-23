import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../../../../src/api/client.js";
import type { PersonDetailRes, PersonPageRes } from "../../../../src/api/generated/index.js";
import * as pathApi from "../../../../src/api/path.js";
import { createPersonCommand } from "../../../../src/commands/path/person.js";
import { UsageError } from "../../../../src/errors/index.js";
import type { Formatter, OutputContext } from "../../../../src/output/index.js";

vi.mock("../../../../src/api/path.js", () => ({
  deletePerson: vi.fn(),
  exportPersons: vi.fn(),
  getPerson: vi.fn(),
  listPersons: vi.fn(),
  mergePersons: vi.fn(),
  updatePerson: vi.fn(),
}));

interface CommandHarness {
  client: ApiClient;
  formatter: Formatter;
  run: (argv: string[]) => Promise<void>;
  writeStdout: ReturnType<typeof vi.fn<(text: string) => void>>;
}

interface FormatterDouble extends Formatter {
  error: ReturnType<typeof vi.fn<Formatter["error"]>>;
  list: ReturnType<typeof vi.fn<Formatter["list"]>>;
  output: ReturnType<typeof vi.fn<Formatter["output"]>>;
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
    error: vi.fn((_error: Error, _ctx: OutputContext): void => {}),
    list: vi.fn(
      (_items: Record<string, unknown>[], _columns, _ctx: OutputContext, _nextActions): void => {},
    ),
    output: vi.fn((_data: Record<string, unknown>, _ctx: OutputContext, _nextActions): void => {}),
  };
}

function createHarness(): CommandHarness {
  const client = createClientStub();
  const formatter = createFormatterDouble();
  const writeStdout = vi.fn<(text: string) => void>();
  const command = createPersonCommand({
    client,
    formatter,
    writeStdout,
  });
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  return {
    client,
    formatter,
    run: async (argv: string[]): Promise<void> => {
      await program.parseAsync(["person", ...argv], { from: "user" });
    },
    writeStdout,
  };
}

describe("createPersonCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards list filters", async () => {
    const harness = createHarness();
    const page: PersonPageRes = {
      content: [],
      pageNumber: 3,
      pageSize: 15,
      totalElements: 0,
      totalPages: 0,
    };
    vi.mocked(pathApi.listPersons).mockResolvedValueOnce(page);

    await harness.run([
      "list",
      "--keyword",
      "alice",
      "--channel-id",
      "12",
      "--channel-id",
      "13",
      "--event-id",
      "4",
      "--company-name",
      "TalkValue",
      "--job-title",
      "Engineer",
      "--page",
      "3",
      "--page-size",
      "15",
      "--sort",
      "name,asc",
      "--sort",
      "createdAt,desc",
    ]);

    expect(pathApi.listPersons).toHaveBeenCalledWith(harness.client, {
      channelId: [12, 13],
      companyName: "TalkValue",
      eventId: [4],
      jobTitle: "Engineer",
      keyword: "alice",
      pageNumber: 3,
      pageSize: 15,
      sort: ["name,asc", "createdAt,desc"],
    });
    expect(harness.formatter.list).toHaveBeenCalledWith([], expect.any(Array), {
      pagination: {
        page: 3,
        pageSize: 15,
        totalElements: 0,
        totalPages: 0,
      },
    });
  });

  it("parses get id and calls getPerson", async () => {
    const harness = createHarness();
    const person = { id: 21 } as PersonDetailRes;
    vi.mocked(pathApi.getPerson).mockResolvedValueOnce(person);

    await harness.run(["get", "21"]);

    expect(pathApi.getPerson).toHaveBeenCalledWith(harness.client, 21);
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("forwards only provided update fields", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.updatePerson).mockResolvedValueOnce({ id: 2 } as PersonDetailRes);

    await harness.run([
      "update",
      "2",
      "--first-name",
      "Ada",
      "--primary-email",
      "ada@example.com",
      "--company-name",
      "Analytical Engines",
    ]);

    expect(pathApi.updatePerson).toHaveBeenCalledWith(harness.client, 2, {
      companyName: "Analytical Engines",
      firstName: "Ada",
      primaryEmail: "ada@example.com",
    });
  });

  it("throws UsageError when delete confirm is missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["delete", "9"])).rejects.toBeInstanceOf(UsageError);
    expect(pathApi.deletePerson).not.toHaveBeenCalled();
  });

  it("deletes when --confirm is provided", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.deletePerson).mockResolvedValueOnce(undefined);

    await harness.run(["delete", "9", "--confirm"]);

    expect(pathApi.deletePerson).toHaveBeenCalledWith(harness.client, 9);
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("throws UsageError when merge confirm is missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["merge", "5", "8"])).rejects.toBeInstanceOf(UsageError);
    expect(pathApi.mergePersons).not.toHaveBeenCalled();
  });

  it("merges when --confirm is provided", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.mergePersons).mockResolvedValueOnce({ id: 8 } as PersonDetailRes);

    await harness.run(["merge", "5", "8", "--confirm"]);

    expect(pathApi.mergePersons).toHaveBeenCalledWith(harness.client, 5, 8);
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("exports CSV via raw stdout", async () => {
    const harness = createHarness();
    vi.mocked(pathApi.exportPersons).mockResolvedValueOnce("id,name\n1,Alice\n");

    await harness.run(["export", "--keyword", "alice", "--page", "2", "--sort", "name,asc"]);

    expect(pathApi.exportPersons).toHaveBeenCalledWith(harness.client, {
      keyword: "alice",
      pageNumber: 2,
      sort: ["name,asc"],
    });
    expect(harness.writeStdout).toHaveBeenCalledWith("id,name\n1,Alice\n");
    expect(harness.formatter.output).not.toHaveBeenCalled();
    expect(harness.formatter.list).not.toHaveBeenCalled();
  });
});
