import { readFileSync } from "node:fs";

import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkImport } from "../../../../src/api/generated/path/sdk.gen.js";
import { createImportCommand } from "../../../../src/commands/path/import.js";
import { UsageError } from "../../../../src/errors/index.js";
import type { Formatter, OutputContext } from "../../../../src/output/index.js";
import * as sharedModule from "../../../../src/shared/context.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

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
  BulkImport: {
    listImportJobs: vi.fn(),
    getImportJob: vi.fn(),
    createImport: vi.fn(),
    analyzeImport: vi.fn(),
    exportFailedRowsCsv: vi.fn(),
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

  const command = createImportCommand({ formatter, writeStdout });
  command.exitOverride();
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  return {
    formatter,
    run: async (argv: string[]): Promise<void> => {
      await program.parseAsync(["import", ...argv], { from: "user" });
    },
    writeStdout,
  };
}

describe("createImportCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list calls listImportJobs with pagination", async () => {
    const harness = createHarness();
    vi.mocked(BulkImport.listImportJobs).mockResolvedValueOnce({
      data: {
        content: [
          {
            id: 1,
            status: "COMPLETED",
            mode: "UPDATE",
            fileName: "contacts.csv",
            totalRows: 100,
            newCount: 50,
            failedCount: 2,
            completedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        pageNumber: 1,
        pageSize: 20,
        totalElements: 1,
        totalPages: 1,
      },
    } as any);

    await harness.run(["list", "--page", "1", "--page-size", "20"]);

    expect(BulkImport.listImportJobs).toHaveBeenCalledWith({
      query: {
        pageNumber: 1,
        pageSize: 20,
      },
    });
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("get calls getImportJob with id", async () => {
    const harness = createHarness();
    vi.mocked(BulkImport.getImportJob).mockResolvedValueOnce({
      data: {
        id: 42,
        status: "COMPLETED",
        mode: "SKIP",
        fileName: "leads.csv",
        totalRows: 200,
        newCount: 180,
        failedCount: 5,
        completedAt: "2026-01-01T00:00:00.000Z",
      },
    } as any);

    await harness.run(["get", "42"]);

    expect(BulkImport.getImportJob).toHaveBeenCalledWith({ path: { id: 42 } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("create requires --file-key, --source-id, --mode", async () => {
    const harness = createHarness();

    await expect(harness.run(["create"])).rejects.toBeInstanceOf(UsageError);
    expect(BulkImport.createImport).not.toHaveBeenCalled();
  });

  it("create requires --mapping", async () => {
    const harness = createHarness();

    await expect(
      harness.run(["create", "--file-key", "abc", "--source-id", "1", "--mode", "UPDATE"]),
    ).rejects.toBeInstanceOf(UsageError);
    expect(BulkImport.createImport).not.toHaveBeenCalled();
  });

  it("create parses --mapping correctly", async () => {
    const harness = createHarness();
    vi.mocked(BulkImport.createImport).mockResolvedValueOnce({
      data: {
        id: 10,
        status: "PENDING",
        mode: "UPDATE",
        fileName: "data.csv",
        totalRows: 0,
        newCount: 0,
        failedCount: 0,
        completedAt: null,
      },
    } as any);

    await harness.run([
      "create",
      "--file-key",
      "file-abc",
      "--source-id",
      "7",
      "--mode",
      "UPDATE",
      "--mapping",
      "0:EMAIL",
      "--mapping",
      "1:FIRST_NAME",
    ]);

    expect(BulkImport.createImport).toHaveBeenCalledWith({
      body: {
        columnMappings: [
          { csvIndex: 0, targetField: "EMAIL" },
          { csvIndex: 1, targetField: "FIRST_NAME" },
        ],
        fileKey: "file-abc",
        mode: "UPDATE",
        sourceId: 7,
      },
    });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("analyze calls analyzeImport with file blob", async () => {
    const harness = createHarness();
    const csvBuffer = Buffer.from("email,name\nalice@example.com,Alice\n");
    vi.mocked(readFileSync).mockReturnValueOnce(csvBuffer);
    vi.mocked(BulkImport.analyzeImport).mockResolvedValueOnce({
      data: {
        fileKey: "key-123",
        headers: ["email", "name"],
        rowCount: 1,
        sampleRows: [["alice@example.com", "Alice"]],
      },
    } as any);

    await harness.run(["analyze", "--file", "./contacts.csv"]);

    expect(readFileSync).toHaveBeenCalledWith("./contacts.csv");
    expect(BulkImport.analyzeImport).toHaveBeenCalledWith({
      body: { file: expect.any(File) },
    });
    const actualFile = vi.mocked(BulkImport.analyzeImport).mock.calls[0][0]?.body.file as File;
    expect(actualFile.name).toBe("contacts.csv");
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("analyze throws UsageError when --file missing", async () => {
    const harness = createHarness();

    await expect(harness.run(["analyze"])).rejects.toBeInstanceOf(UsageError);
    expect(BulkImport.analyzeImport).not.toHaveBeenCalled();
  });

  it("failed-export writes CSV to stdout", async () => {
    const harness = createHarness();
    vi.mocked(BulkImport.exportFailedRowsCsv).mockResolvedValueOnce({
      data: undefined,
      response: { ok: true, text: async () => "row,error\n1,invalid email\n" } as any,
    } as any);

    await harness.run(["failed-export", "99"]);

    expect(BulkImport.exportFailedRowsCsv).toHaveBeenCalledWith({
      path: { id: 99 },
      parseAs: "stream",
    });
    expect(harness.writeStdout).toHaveBeenCalledWith("row,error\n1,invalid email\n");
    expect(harness.formatter.output).not.toHaveBeenCalled();
    expect(harness.formatter.list).not.toHaveBeenCalled();
  });

  it("failed-export throws UsageError when response not ok", async () => {
    const harness = createHarness();
    vi.mocked(BulkImport.exportFailedRowsCsv).mockResolvedValueOnce({
      data: undefined,
      response: { ok: false, status: 500, statusText: "Internal Server Error" } as any,
    } as any);

    await expect(harness.run(["failed-export", "99"])).rejects.toBeInstanceOf(UsageError);
    expect(harness.writeStdout).not.toHaveBeenCalled();
  });

  it("failed-export throws UsageError when response.text() fails", async () => {
    const harness = createHarness();
    vi.mocked(BulkImport.exportFailedRowsCsv).mockResolvedValueOnce({
      data: undefined,
      response: {
        ok: true,
        text: async () => {
          throw new Error("Stream read failed");
        },
      } as any,
    } as any);

    await expect(harness.run(["failed-export", "99"])).rejects.toBeInstanceOf(UsageError);
    expect(harness.writeStdout).not.toHaveBeenCalled();
  });

  it("analyze throws UsageError with 'File not found' for ENOENT", async () => {
    const harness = createHarness();
    const enoentError = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
    enoentError.code = "ENOENT";
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw enoentError;
    });

    await expect(harness.run(["analyze", "--file", "./missing.csv"])).rejects.toBeInstanceOf(
      UsageError,
    );
  });

  it("analyze throws UsageError with 'Permission denied' for EACCES", async () => {
    const harness = createHarness();
    const eacceError = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
    eacceError.code = "EACCES";
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw eacceError;
    });

    await expect(harness.run(["analyze", "--file", "./restricted.csv"])).rejects.toBeInstanceOf(
      UsageError,
    );
  });

  it("analyze throws UsageError with generic message for other errors", async () => {
    const harness = createHarness();
    const otherError = new Error("Some other error") as NodeJS.ErrnoException;
    otherError.code = "EISDIR";
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw otherError;
    });

    await expect(harness.run(["analyze", "--file", "./dir.csv"])).rejects.toBeInstanceOf(
      UsageError,
    );
  });
});
