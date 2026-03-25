import { Command } from "commander";

import { Channel } from "../../api/generated/path/sdk.gen.js";
import type {
  CreateChannelReq,
  CreatePersonReq,
  UpdateChannelReq,
} from "../../api/generated/path/types.gen.js";
import type { PersonFilterParams } from "../../api/types.js";
import { unwrap } from "../../api/unwrap.js";
import { UsageError } from "../../errors/index.js";
import type { Formatter } from "../../output/index.js";
import { ensureAuth, resolveFormatter } from "../../shared/context.js";
import {
  parseNumericId,
  pickDefined,
  toOutputContext,
  toOutputRecord,
} from "../../shared/utils.js";

const CHANNEL_COLUMNS = [
  { header: "ID", key: "id" },
  { header: "Name", key: "name" },
  { header: "Icon", key: "icon" },
  { header: "Color", key: "color" },
  { align: "right" as const, header: "People", key: "peopleCount" },
  { header: "Created At", key: "createdAt" },
];

const PERSON_COLUMNS = [
  { header: "ID", key: "id" },
  { header: "Name", key: "name" },
  { header: "Email", key: "primaryEmail" },
  { header: "Phone", key: "primaryPhone" },
  { header: "Company", key: "company" },
  { header: "Job Title", key: "jobTitle" },
  { header: "Joined At", key: "joinedAt" },
];

export interface CreateChannelCommandOptions {
  formatter?: Formatter;
  writeStdout?: (text: string) => void;
}

interface DeleteChannelOptions {
  confirm?: boolean;
}

interface PeopleCommandOptions {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

interface CreateChannelOptions {
  color?: string;
  icon?: string;
  name?: string;
}

interface UpdateChannelOptions {
  color?: string;
  icon?: string;
  name?: string;
}

interface AddPersonCommandOptions {
  address?: string;
  avatarUrl?: string;
  companyName?: string;
  email?: string;
  firstName?: string;
  jobTitle?: string;
  joinedAt?: string;
  lastName?: string;
  linkedInUrl?: string;
  phone?: string[];
  xUrl?: string;
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function createChannelCommand(options: CreateChannelCommandOptions = {}): Command {
  const writeStdout = options.writeStdout ?? ((text: string) => process.stdout.write(text));

  const command = new Command("channel").description("Manage channels in Path");

  command
    .command("list")
    .description("List channels")
    .action(async (_actionOptions: unknown, command: Command) => {
      const formatter = resolveFormatter(command, options);
      await ensureAuth(command);
      const { data } = await Channel.listChannels();
      const channels = unwrap(data, "channels");
      formatter.list(
        channels.map((channel) => toOutputRecord(channel)),
        CHANNEL_COLUMNS,
        toOutputContext(),
      );
    });

  command
    .command("get")
    .description("Get a channel")
    .argument("<id>", "channel id")
    .action(async (rawId: string, _actionOptions: unknown, command: Command) => {
      const formatter = resolveFormatter(command, options);
      await ensureAuth(command);
      const id = parseNumericId(rawId, "channel id");
      // No getChannel endpoint in SDK; filter from listChannels
      const { data } = await Channel.listChannels();
      const channels = unwrap(data, "channels");
      const found = channels.find((c) => c.id === id);
      if (!found) {
        throw new UsageError(`Channel ${id} not found`);
      }
      formatter.output(toOutputRecord(found), toOutputContext());
    });

  command
    .command("create")
    .description("Create a channel")
    .option("-n, --name <name>", "channel name")
    .option("--icon <icon>", "channel icon")
    .option("--color <color>", "channel color")
    .action(async (createOptions: CreateChannelOptions, command: Command) => {
      if (createOptions.name === undefined) {
        throw new UsageError("Creating a channel requires --name");
      }

      const formatter = resolveFormatter(command, options);
      await ensureAuth(command);

      const payload: CreateChannelReq = {
        ...(createOptions.color !== undefined ? { color: createOptions.color } : {}),
        ...(createOptions.icon !== undefined ? { icon: createOptions.icon } : {}),
        name: createOptions.name,
      };
      const { data: channel } = await Channel.createChannel({ body: payload });
      formatter.output(toOutputRecord(unwrap(channel, "channel")), toOutputContext());
    });

  command
    .command("update")
    .description("Update a channel")
    .argument("<id>", "channel id")
    .option("--name <name>", "channel name")
    .option("--icon <icon>", "channel icon")
    .option("--color <color>", "channel color")
    .action(async (rawId: string, updateOptions: UpdateChannelOptions, command: Command) => {
      const payload = pickDefined({
        name: updateOptions.name,
        icon: updateOptions.icon,
        color: updateOptions.color,
      });

      if (Object.keys(payload).length === 0) {
        throw new UsageError("At least one field must be specified for update");
      }

      const formatter = resolveFormatter(command, options);
      await ensureAuth(command);
      const id = parseNumericId(rawId, "channel id");
      const { data: channel } = await Channel.updateChannel({
        path: { id },
        body: payload as UpdateChannelReq,
      });
      formatter.output(toOutputRecord(unwrap(channel, "channel")), toOutputContext());
    });

  command
    .command("delete")
    .description("Delete a channel")
    .argument("<id>", "channel id")
    .option("--confirm", "confirm channel deletion")
    .action(async (rawId: string, deleteOptions: DeleteChannelOptions, command: Command) => {
      if (deleteOptions.confirm !== true) {
        throw new UsageError("Deleting a channel requires --confirm");
      }

      const formatter = resolveFormatter(command, options);
      await ensureAuth(command);
      const id = parseNumericId(rawId, "channel id");
      await Channel.deleteChannel({ path: { id } });
      formatter.output(
        {
          deleted: true,
          id,
        },
        toOutputContext(),
      );
    });

  command
    .command("people")
    .description("List people in a channel")
    .argument("<channelId>", "channel id")
    .option("--keyword <keyword>", "filter by keyword")
    .option("--page <page>", "page number", (v: string) => parseNumericId(v, "page"))
    .option("--page-size <pageSize>", "page size", (v: string) => parseNumericId(v, "page-size"))
    .action(async (rawChannelId: string, peopleOptions: PeopleCommandOptions, command: Command) => {
      const formatter = resolveFormatter(command, options);
      await ensureAuth(command);
      const channelId = parseNumericId(rawChannelId, "channel id");
      const filters = pickDefined<PersonFilterParams>({
        keyword: peopleOptions.keyword,
        pageNumber: peopleOptions.page,
        pageSize: peopleOptions.pageSize,
      });
      const { data: result } = await Channel.listChannelPeople({
        path: { channelId },
        query: filters,
      });
      const page = unwrap(result, "channel people");
      formatter.list(
        page.content.map((person) => toOutputRecord(person)),
        PERSON_COLUMNS,
        toOutputContext({
          page: page.pageNumber,
          pageSize: page.pageSize,
          totalElements: page.totalElements,
          totalPages: page.totalPages,
        }),
      );
    });

  command
    .command("add-person")
    .description("Add a person to a channel")
    .argument("<channelId>", "channel id")
    .option("-e, --email <email>", "person email")
    .option("--first-name <firstName>", "person first name")
    .option("--last-name <lastName>", "person last name")
    .option("--phone <phone>", "person phone", collectValues, [])
    .option("--job-title <jobTitle>", "person job title")
    .option("--address <address>", "person address")
    .option("--avatar-url <avatarUrl>", "person avatar URL")
    .option("--linked-in-url <linkedInUrl>", "person LinkedIn URL")
    .option("--x-url <xUrl>", "person X URL")
    .option("--company-name <companyName>", "person company name")
    .option("--joined-at <joinedAt>", "person joined-at timestamp")
    .action(
      async (rawChannelId: string, addPersonOptions: AddPersonCommandOptions, command: Command) => {
        if (addPersonOptions.email === undefined) {
          throw new UsageError("Adding a person requires --email");
        }

        const formatter = resolveFormatter(command, options);
        await ensureAuth(command);
        const channelId = parseNumericId(rawChannelId, "channel id");
        const payload: CreatePersonReq = {
          ...(addPersonOptions.address !== undefined ? { address: addPersonOptions.address } : {}),
          ...(addPersonOptions.avatarUrl !== undefined
            ? { avatarUrl: addPersonOptions.avatarUrl }
            : {}),
          ...(addPersonOptions.companyName !== undefined
            ? { companyName: addPersonOptions.companyName }
            : {}),
          email: addPersonOptions.email,
          ...(addPersonOptions.firstName !== undefined
            ? { firstName: addPersonOptions.firstName }
            : {}),
          ...(addPersonOptions.jobTitle !== undefined
            ? { jobTitle: addPersonOptions.jobTitle }
            : {}),
          ...(addPersonOptions.joinedAt !== undefined
            ? { joinedAt: addPersonOptions.joinedAt }
            : {}),
          ...(addPersonOptions.lastName !== undefined
            ? { lastName: addPersonOptions.lastName }
            : {}),
          ...(addPersonOptions.linkedInUrl !== undefined
            ? { linkedInUrl: addPersonOptions.linkedInUrl }
            : {}),
          phones: addPersonOptions.phone ?? [],
          ...(addPersonOptions.xUrl !== undefined ? { xUrl: addPersonOptions.xUrl } : {}),
        };
        const { data: person } = await Channel.createChannelPerson({
          path: { channelId },
          body: payload,
        });
        formatter.output(toOutputRecord(unwrap(person, "person")), toOutputContext());
      },
    );

  command
    .command("export")
    .description("Export people in a channel as CSV")
    .argument("<channelId>", "channel id")
    .action(async (rawChannelId: string, _opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ format?: string; json?: boolean }>();
      if (globals.format || globals.json) {
        process.stderr.write("Warning: export commands always output CSV regardless of --format\n");
      }
      await ensureAuth(cmd);
      const channelId = parseNumericId(rawChannelId, "channel id");
      const { response } = await Channel.exportChannelPeopleCsv({
        path: { channelId },
        parseAs: "stream",
      });
      writeStdout(await response.text());
    });

  return command;
}
