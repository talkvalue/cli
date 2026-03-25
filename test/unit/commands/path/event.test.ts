import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Event_ } from "../../../../src/api/generated/path/sdk.gen.js";
import type {
  EventRes,
  PersonDetailRes,
  PersonPageRes,
} from "../../../../src/api/generated/path/types.gen.js";
import { createEventCommand } from "../../../../src/commands/path/event.js";
import { NotFoundError, UsageError } from "../../../../src/errors/index.js";
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
  Event_: {
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    listEventPeople: vi.fn(),
    createEventPerson: vi.fn(),
    exportEventPeopleCsv: vi.fn(),
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

  const command = createEventCommand({
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
      await program.parseAsync(["event", ...argv], { from: "user" });
    },
    writeStdout,
  };
}

describe("createEventCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses list and forwards to listEvents", async () => {
    const harness = createHarness();
    const events: EventRes[] = [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        id: 1,
        location: "Seoul",
        name: "Tech Conference",
        peopleCount: 100,
        startAt: "2026-06-01T09:00:00.000Z",
        timeZone: "Asia/Seoul",
      },
    ];
    vi.mocked(Event_.listEvents).mockResolvedValueOnce({ data: events } as any);

    await harness.run(["list"]);

    expect(Event_.listEvents).toHaveBeenCalled();
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("parses get id and returns matching event", async () => {
    const harness = createHarness();
    vi.mocked(Event_.listEvents).mockResolvedValueOnce({
      data: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: 42,
          name: "Workshop",
          peopleCount: 20,
          startAt: "2026-07-01T10:00:00.000Z",
          timeZone: "America/New_York",
        },
      ],
    } as any);

    await harness.run(["get", "42"]);

    expect(Event_.listEvents).toHaveBeenCalled();
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("throws NotFoundError when get id does not match", async () => {
    const harness = createHarness();
    vi.mocked(Event_.listEvents).mockResolvedValueOnce({
      data: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          id: 1,
          name: "Existing",
          peopleCount: 5,
          startAt: "2026-01-01T00:00:00.000Z",
          timeZone: "UTC",
        },
      ],
    } as any);

    await expect(harness.run(["get", "999"])).rejects.toBeInstanceOf(NotFoundError);
    expect(harness.formatter.output).not.toHaveBeenCalled();
  });

  it("requires --name, --start-at, --time-zone for create", async () => {
    const harness = createHarness();

    await expect(harness.run(["create"])).rejects.toBeInstanceOf(UsageError);
    expect(Event_.createEvent).not.toHaveBeenCalled();
  });

  it("requires --start-at for create even with --name", async () => {
    const harness = createHarness();

    await expect(harness.run(["create", "--name", "Conf"])).rejects.toBeInstanceOf(UsageError);
    expect(Event_.createEvent).not.toHaveBeenCalled();
  });

  it("requires --time-zone for create even with --name and --start-at", async () => {
    const harness = createHarness();

    await expect(
      harness.run(["create", "--name", "Conf", "--start-at", "2026-06-01T09:00:00.000Z"]),
    ).rejects.toBeInstanceOf(UsageError);
    expect(Event_.createEvent).not.toHaveBeenCalled();
  });

  it("forwards create payload with all fields", async () => {
    const harness = createHarness();
    vi.mocked(Event_.createEvent).mockResolvedValueOnce({
      data: {
        createdAt: "2026-01-01T00:00:00.000Z",
        endAt: "2026-06-02T18:00:00.000Z",
        id: 10,
        location: "Gangnam",
        name: "Launch Party",
        peopleCount: 0,
        startAt: "2026-06-01T09:00:00.000Z",
        timeZone: "Asia/Seoul",
      },
    } as any);

    await harness.run([
      "create",
      "--name",
      "Launch Party",
      "--start-at",
      "2026-06-01T09:00:00.000Z",
      "--time-zone",
      "Asia/Seoul",
      "--end-at",
      "2026-06-02T18:00:00.000Z",
      "--location",
      "Gangnam",
    ]);

    expect(Event_.createEvent).toHaveBeenCalledWith({
      body: {
        endAt: "2026-06-02T18:00:00.000Z",
        location: "Gangnam",
        name: "Launch Party",
        startAt: "2026-06-01T09:00:00.000Z",
        timeZone: "Asia/Seoul",
      },
    });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("forwards update payload", async () => {
    const harness = createHarness();
    vi.mocked(Event_.updateEvent).mockResolvedValueOnce({
      data: {
        createdAt: "2026-01-01T00:00:00.000Z",
        id: 5,
        location: "Busan",
        name: "Updated Event",
        peopleCount: 50,
        startAt: "2026-08-01T10:00:00.000Z",
        timeZone: "Asia/Seoul",
      },
    } as any);

    await harness.run([
      "update",
      "5",
      "--name",
      "Updated Event",
      "--start-at",
      "2026-08-01T10:00:00.000Z",
      "--time-zone",
      "Asia/Seoul",
      "--location",
      "Busan",
    ]);

    expect(Event_.updateEvent).toHaveBeenCalledWith({
      path: { id: 5 },
      body: {
        location: "Busan",
        name: "Updated Event",
        startAt: "2026-08-01T10:00:00.000Z",
        timeZone: "Asia/Seoul",
      },
    });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("throws UsageError when delete --confirm is missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["delete", "9"])).rejects.toBeInstanceOf(UsageError);
    expect(Event_.deleteEvent).not.toHaveBeenCalled();
  });

  it("deletes when --confirm is provided", async () => {
    const harness = createHarness();
    vi.mocked(Event_.deleteEvent).mockResolvedValueOnce({ data: undefined } as any);

    await harness.run(["delete", "9", "--confirm"]);

    expect(Event_.deleteEvent).toHaveBeenCalledWith({ path: { id: 9 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("forwards person list filters and pagination", async () => {
    const harness = createHarness();
    const people: PersonPageRes = {
      content: [],
      pageNumber: 2,
      pageSize: 30,
      totalElements: 0,
      totalPages: 0,
    };
    vi.mocked(Event_.listEventPeople).mockResolvedValueOnce({ data: people } as any);

    await harness.run([
      "person",
      "list",
      "16",
      "--keyword",
      "alice",
      "--page",
      "2",
      "--page-size",
      "30",
    ]);

    expect(Event_.listEventPeople).toHaveBeenCalledWith({
      path: { eventId: 16 },
      query: {
        keyword: "alice",
        pageNumber: 2,
        pageSize: 30,
      },
    });
  });

  it("requires --email for person add", async () => {
    const harness = createHarness();

    await expect(harness.run(["person", "add", "7"])).rejects.toBeInstanceOf(UsageError);
    expect(Event_.createEventPerson).not.toHaveBeenCalled();
  });

  it("forwards person add payload with supported fields", async () => {
    const harness = createHarness();
    const person = { id: 7 } as PersonDetailRes;
    vi.mocked(Event_.createEventPerson).mockResolvedValueOnce({ data: person } as any);

    await harness.run([
      "person",
      "add",
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

    expect(Event_.createEventPerson).toHaveBeenCalledWith({
      path: { eventId: 7 },
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
    vi.mocked(Event_.exportEventPeopleCsv).mockResolvedValueOnce({
      data: undefined,
      response: { text: async () => "id,name\n1,Alice\n" } as any,
    } as any);

    await harness.run(["person", "export", "3"]);

    expect(Event_.exportEventPeopleCsv).toHaveBeenCalledWith({
      path: { eventId: 3 },
      parseAs: "stream",
    });
    expect(harness.writeStdout).toHaveBeenCalledWith("id,name\n1,Alice\n");
    expect(harness.formatter.output).not.toHaveBeenCalled();
    expect(harness.formatter.list).not.toHaveBeenCalled();
  });
});
