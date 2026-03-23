import { createInterface } from "node:readline";

import { UsageError } from "../errors/index.js";

export interface Organization {
  id: string;
  name: string;
}

interface PromptOptions {
  isTTY?: boolean;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

function matchOrganization(organizations: Organization[], query: string): Organization | undefined {
  const lower = query.toLowerCase();
  return (
    organizations.find((o) => o.id === query) ??
    organizations.find((o) => o.name.toLowerCase() === lower)
  );
}

async function interactiveSelect(
  organizations: Organization[],
  options: PromptOptions,
): Promise<Organization> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stderr;

  output.write("? Select an organization:\n");
  for (let i = 0; i < organizations.length; i++) {
    output.write(`  ${i + 1}) ${organizations[i].name} (${organizations[i].id})\n`);
  }

  const rl = createInterface({ input, output, terminal: false });
  const maxAttempts = 3;
  let attempts = 0;

  try {
    for await (const line of rl) {
      const index = Number.parseInt(line.trim(), 10) - 1;
      if (index >= 0 && index < organizations.length) {
        return organizations[index];
      }
      attempts++;
      if (attempts >= maxAttempts) {
        throw new UsageError("Too many invalid attempts");
      }
      output.write(`Invalid selection. Enter 1-${organizations.length}: `);
    }
  } finally {
    rl.close();
  }

  throw new UsageError("No organization selected");
}

export async function selectOrganization(
  organizations: Organization[],
  query?: string,
  options: PromptOptions = {},
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

  return interactiveSelect(organizations, options);
}
