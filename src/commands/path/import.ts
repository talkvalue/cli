import { readFileSync } from "node:fs";

import { Command } from "commander";

import { BulkImport } from "../../api/generated/path/sdk.gen.js";
import type { ColumnMappingReq, CreateImportReq } from "../../api/generated/path/types.gen.js";
import { unwrap } from "../../api/unwrap.js";
import { UsageError } from "../../errors/index.js";
import type { ColumnDef, Formatter, OutputContext } from "../../output/index.js";
import { ensureAuth, resolveFormatter } from "../../shared/context.js";

const IMPORT_JOB_COLUMNS: ColumnDef[] = [
  { header: "ID", key: "id" },
  { header: "Status", key: "status" },
  { header: "Mode", key: "mode" },
  { header: "File Name", key: "fileName" },
  { align: "right" as const, header: "Total", key: "totalRows" },
  { align: "right" as const, header: "Processed", key: "processedRows" },
  { align: "right" as const, header: "New", key: "newCount" },
  { align: "right" as const, header: "Failed", key: "failedCount" },
  { header: "Completed At", key: "completedAt" },
];

export interface ImportCommandDependencies {
  formatter?: Formatter;
  writeStdout?: (text: string) => void;
}

interface ListOptions {
  page?: number;
  pageSize?: number;
}

interface CreateOptions {
  fileKey?: string;
  sourceId?: string;
  mode?: string;
  mapping: string[];
}

interface AnalyzeOptions {
  file?: string;
}

function parseNumericId(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new UsageError(`Invalid ${fieldName}: ${value}`);
  }

  return parsed;
}

function toOutputRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function toOutputContext(pagination?: OutputContext["pagination"]): OutputContext {
  return {
    pagination,
  };
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseMapping(raw: string): ColumnMappingReq {
  const parts = raw.split(":");

  if (parts.length !== 2) {
    throw new UsageError(`Invalid mapping format "${raw}". Expected csvIndex:targetField`);
  }

  const csvIndex = Number.parseInt(parts[0], 10);

  if (Number.isNaN(csvIndex)) {
    throw new UsageError(`Invalid csv index in mapping "${raw}"`);
  }

  return { csvIndex, targetField: parts[1] as ColumnMappingReq["targetField"] };
}

export function createImportCommand(dependencies: ImportCommandDependencies = {}): Command {
  const writeStdout = dependencies.writeStdout ?? ((text: string) => process.stdout.write(text));

  const command = new Command("import").description("Manage bulk import jobs");

  command
    .command("list")
    .description("List import jobs")
    .option("--page <page>", "page number", (v: string) => parseNumericId(v, "page"))
    .option("--page-size <pageSize>", "page size", (v: string) => parseNumericId(v, "page-size"))
    .action(async (listOptions: ListOptions, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const { data: result } = await BulkImport.listImportJobs({
        query: {
          pageNumber: listOptions.page,
          pageSize: listOptions.pageSize,
        },
      });
      const page = unwrap(result, "import jobs");
      formatter.list(
        page.content.map((job) => toOutputRecord(job)),
        IMPORT_JOB_COLUMNS,
        toOutputContext({
          page: page.pageNumber,
          pageSize: page.pageSize,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
        }),
      );
    });

  command
    .command("get")
    .description("Get an import job")
    .argument("<id>", "import job id")
    .action(async (rawId: string, _actionOptions: unknown, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const id = parseNumericId(rawId, "import job id");
      const { data: job } = await BulkImport.getImportJob({ path: { id } });
      formatter.output(toOutputRecord(unwrap(job, "import job")), toOutputContext());
    });

  command
    .command("create")
    .description("Create an import job")
    .option("--file-key <fileKey>", "file key from analyze")
    .option("--source-id <sourceId>", "source id (channel id)")
    .option("--mode <mode>", "import mode (UPDATE or SKIP)")
    .option("--mapping <mapping>", "column mapping (csvIndex:targetField)", collectValues, [])
    .action(async (createOptions: CreateOptions, command: Command) => {
      if (createOptions.fileKey === undefined) {
        throw new UsageError("Creating an import requires --file-key");
      }

      if (createOptions.sourceId === undefined) {
        throw new UsageError("Creating an import requires --source-id");
      }

      if (createOptions.mode === undefined) {
        throw new UsageError("Creating an import requires --mode");
      }

      if (createOptions.mapping.length === 0) {
        throw new UsageError("Creating an import requires at least one --mapping");
      }

      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);

      const sourceId = parseNumericId(createOptions.sourceId, "source id");
      const columnMappings = createOptions.mapping.map(parseMapping);

      const payload: CreateImportReq = {
        columnMappings,
        fileKey: createOptions.fileKey,
        mode: createOptions.mode as CreateImportReq["mode"],
        sourceId,
      };
      const { data: result } = await BulkImport.createImport({ body: payload });
      formatter.output(toOutputRecord(unwrap(result, "import")), toOutputContext());
    });

  command
    .command("analyze")
    .description("Analyze a CSV file for import")
    .option("--file <file>", "path to CSV file")
    .action(async (analyzeOptions: AnalyzeOptions, command: Command) => {
      if (analyzeOptions.file === undefined) {
        throw new UsageError("Analyzing an import requires --file");
      }

      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);

      const fileBuffer = readFileSync(analyzeOptions.file);
      const blob = new Blob([fileBuffer], { type: "text/csv" });

      const { data: result } = await BulkImport.analyzeImport({
        body: { file: blob },
      });
      formatter.output(toOutputRecord(unwrap(result, "analyze")), toOutputContext());
    });

  command
    .command("failed-export")
    .description("Export failed rows as CSV")
    .argument("<id>", "import job id")
    .action(async (rawId: string) => {
      await ensureAuth(command);
      const id = parseNumericId(rawId, "import job id");
      const { response } = await BulkImport.exportFailedRowsCsv({
        path: { id },
        parseAs: "stream",
      });
      writeStdout(await response.text());
    });

  return command;
}
