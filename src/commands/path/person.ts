import { Command, InvalidArgumentError } from "commander";

import { Person } from "../../api/generated/path/sdk.gen.js";
import type { UpdatePersonReq } from "../../api/generated/path/types.gen.js";
import type { PersonFilterParams } from "../../api/types.js";
import { unwrap } from "../../api/unwrap.js";
import { UsageError } from "../../errors/index.js";
import { createFormatter, detectFormat } from "../../output/index.js";
import type { ColumnDef, Formatter, OutputContext } from "../../output/index.js";
import { requireAuth, resolveCommandContext } from "../../shared/context.js";

interface PersonCommandDependencies {
  formatter?: Formatter;
  writeStdout?: (text: string) => void;
}

interface ListOptions {
  channelId: number[];
  companyName?: string;
  eventId: number[];
  jobTitle?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sort: string[];
}

interface UpdateOptions {
  address?: string;
  avatarUrl?: string;
  companyName?: string;
  email: string[];
  firstName?: string;
  jobTitle?: string;
  lastName?: string;
  linkedinUrl?: string;
  phone: string[];
  primaryEmail?: string;
  primaryPhone?: string;
  xUrl?: string;
}

interface ConfirmOptions {
  confirm?: boolean;
}

const PERSON_LIST_COLUMNS: ColumnDef[] = [
  { header: "ID", key: "id" },
  { header: "Name", key: "name" },
  { header: "Primary Email", key: "primaryEmail" },
  { header: "Company", key: "companyName" },
  { header: "Job Title", key: "jobTitle" },
];

function parseInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError(`${label} must be a number`);
  }

  return parsed;
}

function parseId(value: string): number {
  return parseInteger(value, "id");
}

function collectNumber(label: string): (value: string, previous: number[]) => number[] {
  return (value: string, previous: number[]): number[] => {
    return [...previous, parseInteger(value, label)];
  };
}

function collectString(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function buildFilterParams(options: ListOptions): PersonFilterParams {
  const filters: PersonFilterParams = {};

  if (options.keyword !== undefined) {
    filters.keyword = options.keyword;
  }

  if (options.channelId.length > 0) {
    filters.channelId = options.channelId;
  }

  if (options.eventId.length > 0) {
    filters.eventId = options.eventId;
  }

  if (options.companyName !== undefined) {
    filters.companyName = options.companyName;
  }

  if (options.jobTitle !== undefined) {
    filters.jobTitle = options.jobTitle;
  }

  if (options.page !== undefined) {
    filters.pageNumber = options.page;
  }

  if (options.pageSize !== undefined) {
    filters.pageSize = options.pageSize;
  }

  if (options.sort.length > 0) {
    filters.sort = options.sort;
  }

  return filters;
}

function buildUpdatePayload(options: UpdateOptions): UpdatePersonReq {
  const payload: UpdatePersonReq = {};

  if (options.firstName !== undefined) {
    payload.firstName = options.firstName;
  }

  if (options.lastName !== undefined) {
    payload.lastName = options.lastName;
  }

  if (options.primaryEmail !== undefined) {
    payload.primaryEmail = options.primaryEmail;
  }

  if (options.email.length > 0) {
    payload.emails = options.email;
  }

  if (options.primaryPhone !== undefined) {
    payload.primaryPhone = options.primaryPhone;
  }

  if (options.phone.length > 0) {
    payload.phones = options.phone;
  }

  if (options.jobTitle !== undefined) {
    payload.jobTitle = options.jobTitle;
  }

  if (options.address !== undefined) {
    payload.address = options.address;
  }

  if (options.avatarUrl !== undefined) {
    payload.avatarUrl = options.avatarUrl;
  }

  if (options.linkedinUrl !== undefined) {
    payload.linkedInUrl = options.linkedinUrl;
  }

  if (options.xUrl !== undefined) {
    payload.xUrl = options.xUrl;
  }

  if (options.companyName !== undefined) {
    payload.companyName = options.companyName;
  }

  return payload;
}

function toOutputContext(pagination?: OutputContext["pagination"]): OutputContext {
  return {
    pagination,
  };
}

function ensureConfirmed(confirmed: boolean | undefined, action: string): void {
  if (!confirmed) {
    throw new UsageError(`${action} requires --confirm`);
  }
}

function resolveFormatter(command: Command, dependencies: PersonCommandDependencies): Formatter {
  if (dependencies.formatter !== undefined) {
    return dependencies.formatter;
  }

  const globals = command.optsWithGlobals<{ format?: string }>();
  return createFormatter(detectFormat(globals.format));
}

async function ensureAuth(command: Command): Promise<void> {
  const context = await resolveCommandContext(command);
  await requireAuth(context);
}

function resolveWriteStdout(dependencies: PersonCommandDependencies): (text: string) => void {
  if (dependencies.writeStdout !== undefined) {
    return dependencies.writeStdout;
  }

  return (text: string): void => {
    process.stdout.write(text);
  };
}

export function createPersonCommand(dependencies: PersonCommandDependencies = {}): Command {
  const personCommand = new Command("person").description("Manage people in Path");
  const writeStdout = resolveWriteStdout(dependencies);

  personCommand
    .command("list")
    .description("List people")
    .option("--keyword <keyword>", "keyword filter")
    .option("--channel-id <id>", "channel filter", collectNumber("channel-id"), [])
    .option("--event-id <id>", "event filter", collectNumber("event-id"), [])
    .option("--company-name <name>", "company name filter")
    .option("--job-title <title>", "job title filter")
    .option("--page <n>", "page number", (value: string) => parseInteger(value, "page"))
    .option("--page-size <n>", "page size", (value: string) => parseInteger(value, "page-size"))
    .option("--sort <value>", "sort expression", collectString, [])
    .action(async (options: ListOptions, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const filters = buildFilterParams(options);
      const { data } = await Person.listPeople({ query: filters });
      const list = unwrap(data, "people");
      const rows = list.content.map((person) => ({
        companyName: person.company?.displayName ?? null,
        id: person.id,
        jobTitle: person.jobTitle,
        name: person.name,
        primaryEmail: person.primaryEmail,
      }));

      formatter.list(
        rows,
        PERSON_LIST_COLUMNS,
        toOutputContext({
          page: list.pageNumber,
          pageSize: list.pageSize,
          totalElements: list.totalElements,
          totalPages: list.totalPages,
        }),
      );
    });

  personCommand
    .command("get")
    .argument("<id>", "person id", parseId)
    .description("Get person details")
    .action(async (id: number, _options: unknown, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const { data: person } = await Person.getPerson({ path: { id } });

      formatter.output({ ...unwrap(person, "person") }, toOutputContext());
    });

  personCommand
    .command("update")
    .argument("<id>", "person id", parseId)
    .description("Update a person")
    .option("--first-name <name>")
    .option("--last-name <name>")
    .option("--primary-email <email>")
    .option("--email <email>", "email value", collectString, [])
    .option("--primary-phone <phone>")
    .option("--phone <phone>", "phone value", collectString, [])
    .option("--job-title <title>")
    .option("--address <address>")
    .option("--avatar-url <url>")
    .option("--linkedin-url <url>")
    .option("--x-url <url>")
    .option("--company-name <name>")
    .action(async (id: number, options: UpdateOptions, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const payload = buildUpdatePayload(options);
      const { data: person } = await Person.updatePerson({ path: { id }, body: payload });

      formatter.output({ ...unwrap(person, "person") }, toOutputContext());
    });

  personCommand
    .command("delete")
    .argument("<id>", "person id", parseId)
    .description("Delete a person")
    .option("--confirm", "confirm deletion")
    .action(async (id: number, options: ConfirmOptions, command: Command) => {
      ensureConfirmed(options.confirm, "delete");

      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      await Person.deletePerson({ path: { id } });
      formatter.output({ deleted: true, id }, toOutputContext());
    });

  personCommand
    .command("merge")
    .argument("<sourceId>", "source person id", parseId)
    .argument("<targetId>", "target person id", parseId)
    .description("Merge source person into target person")
    .option("--confirm", "confirm merge")
    .action(
      async (sourceId: number, targetId: number, options: ConfirmOptions, command: Command) => {
        ensureConfirmed(options.confirm, "merge");

        const formatter = resolveFormatter(command, dependencies);
        await ensureAuth(command);
        const { data: person } = await Person.mergePerson({ path: { sourceId, targetId } });

        formatter.output({ ...unwrap(person, "person") }, toOutputContext());
      },
    );

  personCommand
    .command("export")
    .description("Export people as CSV")
    .action(async (_options: unknown, command: Command) => {
      await ensureAuth(command);
      const { response } = await Person.exportPeopleCsv({
        parseAs: "stream",
      });

      writeStdout(await response.text());
    });

  return personCommand;
}
