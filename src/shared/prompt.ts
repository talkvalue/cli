import select from "@inquirer/select";

import { UsageError } from "../errors/index.js";

export interface Organization {
  id: string;
  name: string;
}

function matchOrganization(organizations: Organization[], query: string): Organization | undefined {
  const lower = query.toLowerCase();
  return (
    organizations.find((o) => o.id === query) ??
    organizations.find((o) => o.name.toLowerCase() === lower)
  );
}

export async function selectOrganization(
  organizations: Organization[],
  query?: string,
  options: { isTTY?: boolean } = {},
): Promise<Organization> {
  if (organizations.length === 0) {
    throw new UsageError("No organizations available");
  }

  if (organizations.length === 1) {
    return organizations[0];
  }

  if (query) {
    const match = matchOrganization(organizations, query);
    if (!match) {
      throw new UsageError(`No organization matching "${query}"`);
    }
    return match;
  }

  const isTTY = options.isTTY ?? process.stdin.isTTY ?? false;
  if (!isTTY) {
    throw new UsageError("Multiple organizations available. Use --org <name-or-id> to select one.");
  }

  return select({
    message: "Select an organization",
    choices: organizations.map((org) => ({
      name: org.name,
      value: org,
    })),
  });
}
