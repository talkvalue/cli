import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Company } from "../../../../src/api/generated/path/sdk.gen.js";
import type {
  CompanyPageRes,
  CompanyRes,
  PersonPageRes,
} from "../../../../src/api/generated/path/types.gen.js";
import { createCompanyCommand } from "../../../../src/commands/path/company.js";
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
  Company: {
    listCompanies: vi.fn(),
    getCompany: vi.fn(),
    updateCompany: vi.fn(),
    listCompanyPeople: vi.fn(),
    exportCompanyPeopleCsv: vi.fn(),
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

  const command = createCompanyCommand({
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
      await program.parseAsync(["company", ...argv], { from: "user" });
    },
    writeStdout,
  };
}

describe("createCompanyCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses list with pagination and forwards to listCompanies", async () => {
    const harness = createHarness();
    const page: CompanyPageRes = {
      content: [
        {
          id: 1,
          domain: "acme.com",
          displayName: "Acme Corp",
          peopleCount: 10,
        },
      ],
      pageNumber: 2,
      pageSize: 20,
      totalElements: 50,
      totalPages: 3,
    };
    vi.mocked(Company.listCompanies).mockResolvedValueOnce({ data: page } as any);

    await harness.run(["list", "--page", "2", "--page-size", "20"]);

    expect(Company.listCompanies).toHaveBeenCalledWith({
      query: {
        pageNumber: 2,
        pageSize: 20,
      },
    });
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("parses get id and forwards numeric value to getCompany", async () => {
    const harness = createHarness();
    const company: CompanyRes = {
      id: 42,
      domain: "example.com",
      displayName: "Example Inc",
      peopleCount: 5,
    };
    vi.mocked(Company.getCompany).mockResolvedValueOnce({ data: company } as any);

    await harness.run(["get", "42"]);

    expect(Company.getCompany).toHaveBeenCalledWith({ path: { id: 42 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("requires --display-name for update", async () => {
    const harness = createHarness();

    await expect(harness.run(["update", "1"])).rejects.toThrow();
    expect(Company.updateCompany).not.toHaveBeenCalled();
  });

  it("forwards update payload", async () => {
    const harness = createHarness();
    const company: CompanyRes = {
      id: 5,
      domain: "acme.com",
      displayName: "Acme Corp",
      peopleCount: 10,
    };
    vi.mocked(Company.updateCompany).mockResolvedValueOnce({ data: company } as any);

    await harness.run(["update", "5", "--display-name", "Acme Corp"]);

    expect(Company.updateCompany).toHaveBeenCalledWith({
      path: { id: 5 },
      body: {
        displayName: "Acme Corp",
      },
    });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("forwards person list filters for pagination and keyword", async () => {
    const harness = createHarness();
    const people: PersonPageRes = {
      content: [],
      pageNumber: 1,
      pageSize: 30,
      totalElements: 0,
      totalPages: 0,
    };
    vi.mocked(Company.listCompanyPeople).mockResolvedValueOnce({ data: people } as any);

    await harness.run([
      "person",
      "list",
      "9",
      "--keyword",
      "alice",
      "--page",
      "1",
      "--page-size",
      "30",
      "--event-id",
      "16",
      "--sort",
      "joinedAt:desc",
    ]);

    expect(Company.listCompanyPeople).toHaveBeenCalledWith({
      path: { companyId: 9 },
      query: {
        keyword: "alice",
        pageNumber: 1,
        pageSize: 30,
        eventId: [16],
        sort: ["joinedAt:desc"],
      },
    });
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("exports CSV via raw stdout writer", async () => {
    const harness = createHarness();
    vi.mocked(Company.exportCompanyPeopleCsv).mockResolvedValueOnce({
      data: undefined,
      response: { text: async () => "id,name\n1,Alice\n" } as any,
    } as any);

    await harness.run(["person", "export", "3"]);

    expect(Company.exportCompanyPeopleCsv).toHaveBeenCalledWith({
      path: { companyId: 3 },
      parseAs: "stream",
    });
    expect(harness.writeStdout).toHaveBeenCalledWith("id,name\n1,Alice\n");
    expect(harness.formatter.output).not.toHaveBeenCalled();
    expect(harness.formatter.list).not.toHaveBeenCalled();
  });

  it("forwards keyword filter for company list", async () => {
    const harness = createHarness();
    const page: CompanyPageRes = {
      content: [
        {
          id: 3,
          domain: "acme.com",
          displayName: "Acme Corp",
          peopleCount: 7,
        },
      ],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    };
    vi.mocked(Company.listCompanies).mockResolvedValueOnce({ data: page } as any);

    await harness.run(["list", "--keyword", "acme"]);

    expect(Company.listCompanies).toHaveBeenCalledWith({
      query: {
        keyword: "acme",
      },
    });
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });
});
