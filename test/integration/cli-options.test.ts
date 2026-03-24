import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Person } from "../../src/api/generated/path/sdk.gen.js";
import type { PersonPageRes } from "../../src/api/generated/path/types.gen.js";
import { createProgram } from "../../src/cli.js";

vi.mock("../../src/shared/context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/context.js")>();
  return {
    ...actual,
    resolveCommandContext: vi.fn().mockResolvedValue({
      baseUrl: "https://api.test.com",
      config: {
        active_profile: "test",
        api_url: "https://api.test.com",
        client_id: "client_test",
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
      formatter: actual.resolveCommandContext,
      output: {},
      profile: "test",
    }),
    requireAuth: vi.fn().mockResolvedValue(undefined),
    ensureAuth: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../src/api/generated/path/sdk.gen.js", () => ({
  Person: {
    listPeople: vi.fn(),
    getPerson: vi.fn(),
    updatePerson: vi.fn(),
    deletePerson: vi.fn(),
    mergePerson: vi.fn(),
    exportPeopleCsv: vi.fn(),
  },
  Channel: {
    listChannels: vi.fn(),
  },
  Overview: {
    getOverview: vi.fn(),
  },
}));

vi.mock("../../src/api/interceptors.js", () => ({
  configureClients: vi.fn(),
}));

function mockPersonPage(overrides?: Partial<PersonPageRes>): PersonPageRes {
  return {
    content: [],
    pageNumber: 0,
    pageSize: 20,
    totalElements: 0,
    totalPages: 0,
    ...overrides,
  };
}

describe("CLI full-tree option forwarding", () => {
  let stdoutChunks: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutChunks = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("--page and --page-size are forwarded to API through full CLI tree", async () => {
    vi.mocked(Person.listPeople).mockResolvedValueOnce({
      data: mockPersonPage({ pageNumber: 2, pageSize: 50, totalElements: 100, totalPages: 2 }),
    } as any);

    const program = createProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "talkvalue",
      "--format",
      "json",
      "path",
      "person",
      "list",
      "--page",
      "2",
      "--page-size",
      "50",
    ]);

    expect(Person.listPeople).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          pageNumber: 2,
          pageSize: 50,
        }),
      }),
    );
  });

  it("--json flag produces JSON output", async () => {
    vi.mocked(Person.listPeople).mockResolvedValueOnce({
      data: mockPersonPage(),
    } as any);

    const program = createProgram();
    program.exitOverride();
    await program.parseAsync(["node", "talkvalue", "--json", "path", "person", "list"]);

    const output = stdoutChunks.join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("data");
  });

  it("person list includes joinedAt and createdAt in JSON output", async () => {
    vi.mocked(Person.listPeople).mockResolvedValueOnce({
      data: mockPersonPage({
        content: [
          {
            id: 1,
            name: "Alice",
            primaryEmail: "alice@test.com",
            channels: [],
            events: [],
            joinedAt: "2026-03-01T00:00:00Z",
            createdAt: "2026-01-15T00:00:00Z",
          },
        ] as any,
        totalElements: 1,
        totalPages: 1,
      }),
    } as any);

    const program = createProgram();
    program.exitOverride();
    await program.parseAsync(["node", "talkvalue", "--format", "json", "path", "person", "list"]);

    const output = stdoutChunks.join("");
    const parsed = JSON.parse(output);
    expect(parsed.data[0]).toHaveProperty("joinedAt", "2026-03-01T00:00:00Z");
    expect(parsed.data[0]).toHaveProperty("createdAt", "2026-01-15T00:00:00Z");
  });

  it("pagination metadata is included in JSON output", async () => {
    vi.mocked(Person.listPeople).mockResolvedValueOnce({
      data: mockPersonPage({ pageNumber: 1, pageSize: 20, totalElements: 50, totalPages: 3 }),
    } as any);

    const program = createProgram();
    program.exitOverride();
    await program.parseAsync([
      "node",
      "talkvalue",
      "--format",
      "json",
      "path",
      "person",
      "list",
      "--page",
      "1",
    ]);

    const output = stdoutChunks.join("");
    const parsed = JSON.parse(output);
    expect(parsed.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalElements: 50,
      totalPages: 3,
    });
  });
});
