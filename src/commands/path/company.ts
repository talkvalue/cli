import { Command } from "commander";

import { Company } from "../../api/generated/path/sdk.gen.js";
import type { UpdateCompanyReq } from "../../api/generated/path/types.gen.js";
import { unwrap } from "../../api/unwrap.js";
import type { ColumnDef, Formatter } from "../../output/index.js";
import { ensureAuth, resolveFormatter } from "../../shared/context.js";
import {
  collectNumber,
  collectString,
  parseInteger,
  parseNumericId,
  toOutputContext,
} from "../../shared/utils.js";

export interface CompanyCommandDependencies {
  formatter?: Formatter;
  writeStdout?: (text: string) => void;
}

interface CompanyListOptions {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

interface PersonListOptions {
  channelId: number[];
  companyName?: string;
  eventId: number[];
  jobTitle?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sort: string[];
}

const COMPANY_LIST_COLUMNS: ColumnDef[] = [
  { header: "ID", key: "id" },
  { header: "Domain", key: "domain" },
  { header: "Display Name", key: "displayName" },
  { align: "right" as const, header: "People", key: "peopleCount" },
];

const PERSON_LIST_COLUMNS: ColumnDef[] = [
  { header: "ID", key: "id" },
  { header: "Name", key: "name" },
  { header: "Primary Email", key: "primaryEmail" },
  { header: "Company", key: "companyName" },
  { header: "Job Title", key: "jobTitle" },
  { header: "Joined At", key: "joinedAt" },
  { header: "Created At", key: "createdAt" },
];

const parseId = (value: string): number => parseNumericId(value, "id");

function resolveWriteStdout(dependencies: CompanyCommandDependencies): (text: string) => void {
  if (dependencies.writeStdout !== undefined) {
    return dependencies.writeStdout;
  }

  return (text: string): void => {
    process.stdout.write(text);
  };
}

export function createCompanyCommand(dependencies: CompanyCommandDependencies = {}): Command {
  const companyCommand = new Command("company").description("Manage companies in Path");
  const writeStdout = resolveWriteStdout(dependencies);

  companyCommand
    .command("list")
    .description("List companies")
    .option("--keyword <keyword>", "keyword filter")
    .option("--page <n>", "page number", (value: string) => parseInteger(value, "page"))
    .option("--page-size <n>", "page size", (value: string) => parseInteger(value, "page-size"))
    .action(async (options: CompanyListOptions, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);

      const query: Record<string, unknown> = {};

      if (options.keyword !== undefined) {
        query.keyword = options.keyword;
      }

      if (options.page !== undefined) {
        query.pageNumber = options.page;
      }

      if (options.pageSize !== undefined) {
        query.pageSize = options.pageSize;
      }

      const { data } = await Company.listCompanies({ query });
      const page = unwrap(data, "companies");

      formatter.list(
        page.content.map((company) => ({ ...company })),
        COMPANY_LIST_COLUMNS,
        toOutputContext({
          page: page.pageNumber,
          pageSize: page.pageSize,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
        }),
      );
    });

  companyCommand
    .command("get")
    .argument("<id>", "company id", parseId)
    .description("Get company details")
    .action(async (id: number, _options: unknown, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const { data: company } = await Company.getCompany({ path: { id } });

      formatter.output({ ...unwrap(company, "company") }, toOutputContext());
    });

  companyCommand
    .command("update")
    .argument("<id>", "company id", parseId)
    .description("Update a company")
    .requiredOption("--display-name <name>", "company display name")
    .action(async (id: number, options: { displayName: string }, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const payload: UpdateCompanyReq = {
        displayName: options.displayName,
      };
      const { data: company } = await Company.updateCompany({ path: { id }, body: payload });

      formatter.output({ ...unwrap(company, "company") }, toOutputContext());
    });

  const personCommand = companyCommand.command("person").description("Manage people in a company");

  personCommand
    .command("list")
    .argument("<companyId>", "company id", parseId)
    .description("List people in a company")
    .option("--keyword <keyword>", "keyword filter")
    .option("--channel-id <id>", "channel filter", collectNumber("channel-id"), [])
    .option("--event-id <id>", "event filter", collectNumber("event-id"), [])
    .option("--company-name <name>", "company name filter")
    .option("--job-title <title>", "job title filter")
    .option("--page <n>", "page number", (value: string) => parseInteger(value, "page"))
    .option("--page-size <n>", "page size", (value: string) => parseInteger(value, "page-size"))
    .option("--sort <value>", "sort expression", collectString, [])
    .action(async (companyId: number, options: PersonListOptions, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);

      const query: Record<string, unknown> = {};

      if (options.keyword !== undefined) {
        query.keyword = options.keyword;
      }

      if (options.channelId.length > 0) {
        query.channelId = options.channelId;
      }

      if (options.eventId.length > 0) {
        query.eventId = options.eventId;
      }

      if (options.companyName !== undefined) {
        query.companyName = options.companyName;
      }

      if (options.jobTitle !== undefined) {
        query.jobTitle = options.jobTitle;
      }

      if (options.page !== undefined) {
        query.pageNumber = options.page;
      }

      if (options.pageSize !== undefined) {
        query.pageSize = options.pageSize;
      }

      if (options.sort.length > 0) {
        query.sort = options.sort;
      }

      const { data } = await Company.listCompanyPeople({
        path: { companyId },
        query,
      });
      const page = unwrap(data, "company people");

      const rows = page.content.map((person) => ({
        ...person,
        companyName: person.company?.displayName ?? null,
      }));

      formatter.list(
        rows,
        PERSON_LIST_COLUMNS,
        toOutputContext({
          page: page.pageNumber,
          pageSize: page.pageSize,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
        }),
      );
    });

  personCommand
    .command("export")
    .argument("<companyId>", "company id", parseId)
    .description("Export people in a company as CSV")
    .action(async (companyId: number, _opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ format?: string; json?: boolean }>();
      if (globals.format || globals.json) {
        process.stderr.write("Warning: export commands always output CSV regardless of --format\n");
      }
      await ensureAuth(cmd);
      const { response } = await Company.exportCompanyPeopleCsv({
        path: { companyId },
        parseAs: "stream",
      });
      writeStdout(await response.text());
    });

  return companyCommand;
}
