import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Person, PersonActivity } from "../../../../src/api/generated/path/sdk.gen.js";
import type {
  PersonDetailRes,
  PersonPageRes,
} from "../../../../src/api/generated/path/types.gen.js";
import { createPersonCommand } from "../../../../src/commands/path/person.js";
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
  Person: {
    listPeople: vi.fn(),
    getPerson: vi.fn(),
    updatePerson: vi.fn(),
    deletePerson: vi.fn(),
    mergePerson: vi.fn(),
    exportPeopleCsv: vi.fn(),
    undoMergePerson: vi.fn(),
  },
  PersonActivity: {
    getActivity: vi.fn(),
  },
}));

interface CommandHarness {
  formatter: Formatter;
  run: (argv: string[]) => Promise<void>;
  writeStdout: ReturnType<typeof vi.fn<(text: string) => void>>;
}

interface FormatterDouble extends Formatter {
  error: ReturnType<typeof vi.fn<Formatter["error"]>>;
  list: ReturnType<typeof vi.fn<Formatter["list"]>>;
  output: ReturnType<typeof vi.fn<Formatter["output"]>>;
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
  const formatter = createFormatterDouble();
  const writeStdout = vi.fn<(text: string) => void>();

  // Mock resolveCommandContext and requireAuth so ensureAuth passes
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

  const command = createPersonCommand({
    formatter,
    writeStdout,
  });
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  return {
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
    vi.mocked(Person.listPeople).mockResolvedValueOnce({ data: page } as any);

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

    expect(Person.listPeople).toHaveBeenCalledWith({
      query: {
        channelId: [12, 13],
        companyName: "TalkValue",
        eventId: [4],
        jobTitle: "Engineer",
        keyword: "alice",
        pageNumber: 3,
        pageSize: 15,
        sort: ["name,asc", "createdAt,desc"],
      },
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
    vi.mocked(Person.getPerson).mockResolvedValueOnce({ data: person } as any);

    await harness.run(["get", "21"]);

    expect(Person.getPerson).toHaveBeenCalledWith({ path: { id: 21 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("forwards only provided update fields", async () => {
    const harness = createHarness();
    vi.mocked(Person.updatePerson).mockResolvedValueOnce({ data: { id: 2 } } as any);

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

    expect(Person.updatePerson).toHaveBeenCalledWith({
      path: { id: 2 },
      body: {
        companyName: "Analytical Engines",
        firstName: "Ada",
        primaryEmail: "ada@example.com",
      },
    });
  });

  it("throws UsageError when delete confirm is missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["delete", "9"])).rejects.toBeInstanceOf(UsageError);
    expect(Person.deletePerson).not.toHaveBeenCalled();
  });

  it("deletes when --confirm is provided", async () => {
    const harness = createHarness();
    vi.mocked(Person.deletePerson).mockResolvedValueOnce({ data: undefined } as any);

    await harness.run(["delete", "9", "--confirm"]);

    expect(Person.deletePerson).toHaveBeenCalledWith({ path: { id: 9 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("throws UsageError when merge confirm is missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["merge", "5", "8"])).rejects.toBeInstanceOf(UsageError);
    expect(Person.mergePerson).not.toHaveBeenCalled();
  });

  it("merges when --confirm is provided", async () => {
    const harness = createHarness();
    vi.mocked(Person.mergePerson).mockResolvedValueOnce({ data: { id: 8 } } as any);

    await harness.run(["merge", "5", "8", "--confirm"]);

    expect(Person.mergePerson).toHaveBeenCalledWith({ path: { sourceId: 5, targetId: 8 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("exports CSV via raw stdout", async () => {
    const harness = createHarness();
    vi.mocked(Person.exportPeopleCsv).mockResolvedValueOnce({
      data: undefined,
      response: { text: async () => "id,name\n1,Alice\n" } as any,
    } as any);

    await harness.run(["export"]);

    expect(Person.exportPeopleCsv).toHaveBeenCalledWith({
      parseAs: "stream",
    });
    expect(harness.writeStdout).toHaveBeenCalledWith("id,name\n1,Alice\n");
    expect(harness.formatter.output).not.toHaveBeenCalled();
    expect(harness.formatter.list).not.toHaveBeenCalled();
  });

  it("merge-undo throws UsageError without --confirm", async () => {
    const harness = createHarness();

    await expect(harness.run(["merge-undo", "123"])).rejects.toBeInstanceOf(UsageError);
    expect(Person.undoMergePerson).not.toHaveBeenCalled();
  });

  it("merge-undo calls undoMergePerson when confirmed", async () => {
    const harness = createHarness();
    vi.mocked(Person.undoMergePerson).mockResolvedValueOnce({ data: undefined } as any);

    await harness.run(["merge-undo", "123", "--confirm"]);

    expect(Person.undoMergePerson).toHaveBeenCalledWith({ path: { mergeOperationId: 123 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("activity calls getActivity with personId", async () => {
    const harness = createHarness();
    vi.mocked(PersonActivity.getActivity).mockResolvedValueOnce({
      data: { content: [], hasNext: false },
    } as any);

    await harness.run(["activity", "456"]);

    expect(PersonActivity.getActivity).toHaveBeenCalledWith({
      path: { personId: 456 },
      query: {},
    });
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("activity formats entries with actorName", async () => {
    const harness = createHarness();
    vi.mocked(PersonActivity.getActivity).mockResolvedValueOnce({
      data: {
        content: [
          {
            id: 1,
            action: "CREATED",
            actor: { name: "Bob" },
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        hasNext: false,
      },
    } as any);

    await harness.run(["activity", "456"]);

    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
    const rows = vi.mocked(harness.formatter.list).mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorName: "Bob" });
  });

  it("activity forwards cursor and page-size", async () => {
    const harness = createHarness();
    vi.mocked(PersonActivity.getActivity).mockResolvedValueOnce({
      data: { content: [], hasNext: false },
    } as any);

    await harness.run(["activity", "456", "--cursor", "100", "--page-size", "10"]);

    expect(PersonActivity.getActivity).toHaveBeenCalledWith({
      path: { personId: 456 },
      query: { cursor: 100, pageSize: 10 },
    });
  });
});
