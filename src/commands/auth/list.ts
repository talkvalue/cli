import { Command } from "commander";

import type { ColumnDef } from "../../output/formatter.js";
import { resolveCommandContext } from "../../shared/context.js";

const LIST_COLUMNS: ColumnDef[] = [
  { key: "profile", header: "Profile" },
  { key: "orgName", header: "Organization" },
  { key: "memberEmail", header: "Email" },
  { key: "active", header: "Active", format: (v) => (v ? "*" : "") },
];

export function createAuthListCommand(): Command {
  const listCommand = new Command("list").description("List all profiles");

  listCommand.action(async () => {
    const context = await resolveCommandContext(listCommand);
    const activeProfile = context.profile;
    const profiles = Object.entries(context.config.profiles);

    const items = profiles.map(([name, profile]) => ({
      profile: name,
      orgName: profile.org_name || "",
      memberEmail: profile.member_email,
      active: name === activeProfile,
    }));

    context.formatter.list(items, LIST_COLUMNS, context.output);
  });

  return listCommand;
}
