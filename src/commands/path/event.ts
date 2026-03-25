import { Command } from "commander";

import { Event_ } from "../../api/generated/path/sdk.gen.js";
import type {
  CreateEventReq,
  CreatePersonReq,
  UpdateEventReq,
} from "../../api/generated/path/types.gen.js";
import { unwrap } from "../../api/unwrap.js";
import { NotFoundError, UsageError } from "../../errors/index.js";
import type { ColumnDef, Formatter, OutputContext } from "../../output/index.js";
import { ensureAuth, resolveFormatter } from "../../shared/context.js";

export interface EventCommandDependencies {
  formatter?: Formatter;
  writeStdout?: (text: string) => void;
}

interface CreateEventOptions {
  endAt?: string;
  location?: string;
  name?: string;
  startAt?: string;
  timeZone?: string;
}

interface UpdateEventOptions {
  endAt?: string;
  location?: string;
  name?: string;
  startAt?: string;
  timeZone?: string;
}

interface DeleteEventOptions {
  confirm?: boolean;
}

interface PersonListOptions {
  channelId: number[];
  companyId?: number;
  companyName?: string;
  jobTitle?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sort: string[];
}

interface AddPersonOptions {
  address?: string;
  avatarUrl?: string;
  companyName?: string;
  email?: string;
  firstName?: string;
  jobTitle?: string;
  joinedAt?: string;
  lastName?: string;
  linkedInUrl?: string;
  phone: string[];
  xUrl?: string;
}

const EVENT_LIST_COLUMNS: ColumnDef[] = [
  { header: "ID", key: "id" },
  { header: "Name", key: "name" },
  { header: "Time Zone", key: "timeZone" },
  { header: "Start At", key: "startAt" },
  { header: "Location", key: "location" },
  { align: "right" as const, header: "People", key: "peopleCount" },
  { header: "Created At", key: "createdAt" },
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

function toOutputRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

function toOutputContext(pagination?: OutputContext["pagination"]): OutputContext {
  return {
    pagination,
  };
}

function parseNumericId(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new UsageError(`Invalid ${fieldName}: ${value}`);
  }

  return parsed;
}

function collectNumber(label: string): (value: string, previous: number[]) => number[] {
  return (value: string, previous: number[]): number[] => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      throw new UsageError(`Invalid ${label}: ${value}`);
    }
    return [...previous, parsed];
  };
}

function collectString(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function pickDefined<TValue extends object>(value: TValue): Partial<TValue> {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  return Object.fromEntries(entries) as Partial<TValue>;
}

export function createEventCommand(dependencies: EventCommandDependencies = {}): Command {
  const writeStdout = dependencies.writeStdout ?? ((text: string) => process.stdout.write(text));
  const command = new Command("event").description("Manage events in Path");

  command
    .command("list")
    .description("List events")
    .action(async (_actionOptions: unknown, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const { data } = await Event_.listEvents();
      formatter.list((data ?? []).map(toOutputRecord), EVENT_LIST_COLUMNS, toOutputContext());
    });

  command
    .command("get")
    .description("Get an event")
    .argument("<id>", "event id")
    .action(async (rawId: string, _actionOptions: unknown, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const id = parseNumericId(rawId, "event id");
      const { data: events } = await Event_.listEvents();
      const found = (events ?? []).find((e) => e.id === id);
      if (!found) {
        throw new NotFoundError(`Event ${id} not found`);
      }
      formatter.output(toOutputRecord(found), toOutputContext());
    });

  command
    .command("create")
    .description("Create an event")
    .option("-n, --name <name>", "event name")
    .option("--start-at <startAt>", "start date/time")
    .option("--time-zone <timeZone>", "time zone")
    .option("--end-at <endAt>", "end date/time")
    .option("--location <location>", "event location")
    .action(async (createOptions: CreateEventOptions, command: Command) => {
      if (createOptions.name === undefined) {
        throw new UsageError("Creating an event requires --name");
      }
      if (createOptions.startAt === undefined) {
        throw new UsageError("Creating an event requires --start-at");
      }
      if (createOptions.timeZone === undefined) {
        throw new UsageError("Creating an event requires --time-zone");
      }

      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);

      const payload: CreateEventReq = {
        name: createOptions.name,
        startAt: createOptions.startAt,
        timeZone: createOptions.timeZone,
        ...(createOptions.endAt !== undefined ? { endAt: createOptions.endAt } : {}),
        ...(createOptions.location !== undefined ? { location: createOptions.location } : {}),
      };
      const { data: event } = await Event_.createEvent({ body: payload });
      formatter.output(toOutputRecord(unwrap(event, "event")), toOutputContext());
    });

  command
    .command("update")
    .description("Update an event")
    .argument("<id>", "event id")
    .option("--name <name>", "event name")
    .option("--start-at <startAt>", "start date/time")
    .option("--time-zone <timeZone>", "time zone")
    .option("--end-at <endAt>", "end date/time")
    .option("--location <location>", "event location")
    .action(async (rawId: string, updateOptions: UpdateEventOptions, command: Command) => {
      if (updateOptions.name === undefined) {
        throw new UsageError("Updating an event requires --name");
      }
      if (updateOptions.startAt === undefined) {
        throw new UsageError("Updating an event requires --start-at");
      }
      if (updateOptions.timeZone === undefined) {
        throw new UsageError("Updating an event requires --time-zone");
      }

      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const id = parseNumericId(rawId, "event id");

      const payload: UpdateEventReq = {
        name: updateOptions.name,
        startAt: updateOptions.startAt,
        timeZone: updateOptions.timeZone,
        ...(updateOptions.endAt !== undefined ? { endAt: updateOptions.endAt } : {}),
        ...(updateOptions.location !== undefined ? { location: updateOptions.location } : {}),
      };
      const { data: event } = await Event_.updateEvent({ path: { id }, body: payload });
      formatter.output(toOutputRecord(unwrap(event, "event")), toOutputContext());
    });

  command
    .command("delete")
    .description("Delete an event")
    .argument("<id>", "event id")
    .option("--confirm", "confirm event deletion")
    .action(async (rawId: string, deleteOptions: DeleteEventOptions, command: Command) => {
      if (deleteOptions.confirm !== true) {
        throw new UsageError("Deleting an event requires --confirm");
      }

      const formatter = resolveFormatter(command, dependencies);
      await ensureAuth(command);
      const id = parseNumericId(rawId, "event id");
      await Event_.deleteEvent({ path: { id } });
      formatter.output(
        {
          deleted: true,
          id,
        },
        toOutputContext(),
      );
    });

  const personSubCommand = new Command("person").description("Manage event people");

  personSubCommand
    .command("list")
    .description("List people in an event")
    .argument("<eventId>", "event id")
    .option("--keyword <keyword>", "filter by keyword")
    .option("--channel-id <id>", "filter by channel", collectNumber("channel-id"), [])
    .option("--company-id <id>", "filter by company id", (v: string) =>
      parseNumericId(v, "company-id"),
    )
    .option("--company-name <name>", "filter by company name")
    .option("--job-title <title>", "filter by job title")
    .option("--page <n>", "page number", (v: string) => parseNumericId(v, "page"))
    .option("--page-size <n>", "page size", (v: string) => parseNumericId(v, "page-size"))
    .option("--sort <value>", "sort expression", collectString, [])
    .action(async (rawEventId: string, listOptions: PersonListOptions, cmd: Command) => {
      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const eventId = parseNumericId(rawEventId, "event id");
      const query = pickDefined({
        channelId: listOptions.channelId.length > 0 ? listOptions.channelId : undefined,
        companyId: listOptions.companyId,
        companyName: listOptions.companyName,
        jobTitle: listOptions.jobTitle,
        keyword: listOptions.keyword,
        pageNumber: listOptions.page,
        pageSize: listOptions.pageSize,
        sort: listOptions.sort.length > 0 ? listOptions.sort : undefined,
      });
      const { data } = await Event_.listEventPeople({ path: { eventId }, query });
      const page = unwrap(data, "event people");
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

  personSubCommand
    .command("add")
    .description("Add a person to an event")
    .argument("<eventId>", "event id")
    .option("-e, --email <email>", "person email")
    .option("--first-name <firstName>", "person first name")
    .option("--last-name <lastName>", "person last name")
    .option("--phone <phone>", "person phone", collectString, [])
    .option("--company-name <companyName>", "person company name")
    .option("--job-title <jobTitle>", "person job title")
    .option("--address <address>", "person address")
    .option("--avatar-url <avatarUrl>", "person avatar URL")
    .option("--linkedin-url <linkedInUrl>", "person LinkedIn URL")
    .option("--x-url <xUrl>", "person X URL")
    .option("--joined-at <joinedAt>", "person joined-at timestamp")
    .action(async (rawEventId: string, addOptions: AddPersonOptions, cmd: Command) => {
      if (addOptions.email === undefined) {
        throw new UsageError("Adding a person requires --email");
      }

      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const eventId = parseNumericId(rawEventId, "event id");
      const payload: CreatePersonReq = {
        email: addOptions.email,
        phones: addOptions.phone ?? [],
        ...pickDefined({
          address: addOptions.address,
          avatarUrl: addOptions.avatarUrl,
          companyName: addOptions.companyName,
          firstName: addOptions.firstName,
          jobTitle: addOptions.jobTitle,
          joinedAt: addOptions.joinedAt,
          lastName: addOptions.lastName,
          linkedInUrl: addOptions.linkedInUrl,
          xUrl: addOptions.xUrl,
        }),
      };
      const { data: person } = await Event_.createEventPerson({
        path: { eventId },
        body: payload,
      });
      formatter.output(toOutputRecord(unwrap(person, "person")), toOutputContext());
    });

  personSubCommand
    .command("export")
    .description("Export event people as CSV")
    .argument("<eventId>", "event id")
    .action(async (rawEventId: string) => {
      await ensureAuth(command);
      const eventId = parseNumericId(rawEventId, "event id");
      const { response } = await Event_.exportEventPeopleCsv({
        path: { eventId },
        parseAs: "stream",
      });
      writeStdout(await response.text());
    });

  command.addCommand(personSubCommand);

  return command;
}
