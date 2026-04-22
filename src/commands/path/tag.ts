import { Command } from "commander";

import { Tag } from "../../api/generated/path/sdk.gen.js";
import type {
  AttachTagReq,
  CreateTagReq,
  UpdateTagReq,
} from "../../api/generated/path/types.gen.js";
import { unwrap } from "../../api/unwrap.js";
import { UsageError } from "../../errors/index.js";
import type { ColumnDef, Formatter } from "../../output/index.js";
import { ensureAuth, resolveFormatter } from "../../shared/context.js";
import { parseNumericId, toOutputContext, toOutputRecord } from "../../shared/utils.js";

const TAG_COLUMNS: ColumnDef[] = [
  { header: "ID", key: "id" },
  { header: "Name", key: "name" },
];

export interface TagCommandDependencies {
  formatter?: Formatter;
}

interface ListOptions {
  name?: string;
}

interface CreateOptions {
  name?: string;
}

interface UpdateOptions {
  name?: string;
}

interface DeleteOptions {
  confirm?: boolean;
}

interface AttachOptions {
  name?: string;
  tagId?: number;
}

export function createTagCommand(dependencies: TagCommandDependencies = {}): Command {
  const command = new Command("tag").description("Manage tags in Path");

  command
    .command("list")
    .description("List tags")
    .option("--name <name>", "filter by name")
    .action(async (listOptions: ListOptions, cmd: Command) => {
      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const { data } = await Tag.listTags({
        query: { name: listOptions.name },
      });
      const tags = unwrap(data, "tags");
      formatter.list(tags.map(toOutputRecord), TAG_COLUMNS, toOutputContext());
    });

  command
    .command("create")
    .description("Create a tag")
    .option("-n, --name <name>", "tag name")
    .action(async (createOptions: CreateOptions, cmd: Command) => {
      if (createOptions.name === undefined) {
        throw new UsageError("Creating a tag requires --name");
      }

      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const payload: CreateTagReq = { name: createOptions.name };
      const { data: tag } = await Tag.createTag({ body: payload });
      formatter.output(toOutputRecord(unwrap(tag, "tag")), toOutputContext());
    });

  command
    .command("update")
    .description("Update a tag")
    .argument("<id>", "tag id")
    .option("--name <name>", "tag name")
    .action(async (rawId: string, updateOptions: UpdateOptions, cmd: Command) => {
      if (updateOptions.name === undefined) {
        throw new UsageError("Updating a tag requires --name");
      }

      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const id = parseNumericId(rawId, "tag id");
      const payload: UpdateTagReq = { name: updateOptions.name };
      const { data: tag } = await Tag.updateTag({ path: { id }, body: payload });
      formatter.output(toOutputRecord(unwrap(tag, "tag")), toOutputContext());
    });

  command
    .command("delete")
    .description("Delete a tag")
    .argument("<id>", "tag id")
    .option("--confirm", "confirm tag deletion")
    .action(async (rawId: string, deleteOptions: DeleteOptions, cmd: Command) => {
      if (deleteOptions.confirm !== true) {
        throw new UsageError("Deleting a tag requires --confirm");
      }

      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const id = parseNumericId(rawId, "tag id");
      await Tag.deleteTag({ path: { id } });
      formatter.output({ deleted: true, id }, toOutputContext());
    });

  command
    .command("attach")
    .description("Attach a tag to a source (channel or event)")
    .argument("<sourceId>", "source id (channel or event id)")
    .option("--tag-id <id>", "existing tag id", (v: string) => parseNumericId(v, "tag-id"))
    .option("--name <name>", "tag name (creates a new tag if not found)")
    .action(async (rawSourceId: string, attachOptions: AttachOptions, cmd: Command) => {
      if (attachOptions.tagId === undefined && attachOptions.name === undefined) {
        throw new UsageError("Attaching a tag requires --tag-id or --name");
      }

      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const sourceId = parseNumericId(rawSourceId, "source id");
      const payload: AttachTagReq = {
        ...(attachOptions.tagId !== undefined ? { tagId: attachOptions.tagId } : {}),
        ...(attachOptions.name !== undefined ? { name: attachOptions.name } : {}),
      };
      const { data: tag } = await Tag.attachTagToSource({
        path: { sourceId },
        body: payload,
      });
      formatter.output(toOutputRecord(unwrap(tag, "tag")), toOutputContext());
    });

  command
    .command("detach")
    .description("Detach a tag from a source (channel or event)")
    .argument("<sourceId>", "source id (channel or event id)")
    .requiredOption("--tag-id <id>", "tag id to detach", (v: string) => parseNumericId(v, "tag-id"))
    .action(async (rawSourceId: string, detachOptions: { tagId: number }, cmd: Command) => {
      const formatter = resolveFormatter(cmd, dependencies);
      await ensureAuth(cmd);
      const sourceId = parseNumericId(rawSourceId, "source id");
      await Tag.detachTagFromSource({ path: { sourceId, tagId: detachOptions.tagId } });
      formatter.output({ detached: true, sourceId, tagId: detachOptions.tagId }, toOutputContext());
    });

  return command;
}
