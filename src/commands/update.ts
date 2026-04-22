import { Command } from "commander";
import semver from "semver";

import { CliError } from "../errors/index.js";
import type { Formatter } from "../output/index.js";
import { resolveFormatter } from "../shared/context.js";
import { toOutputContext } from "../shared/utils.js";

declare const CLI_VERSION: string;

export const PKG_NAME = "@talkvalue/cli";
const REGISTRY_URL = `https://registry.npmjs.org/${PKG_NAME}/latest`;
const FETCH_TIMEOUT_MS = 10_000;

export interface UpdateCommandDependencies {
  currentVersion?: string;
  fetchLatest?: () => Promise<string>;
  formatter?: Formatter;
  userAgent?: string;
}

async function defaultFetchLatest(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(REGISTRY_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new CliError(
      `Failed to reach npm registry: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new CliError(`npm registry returned ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { version?: unknown };
  if (typeof body.version !== "string" || body.version.length === 0) {
    throw new CliError("npm registry response missing 'version' field");
  }
  return body.version;
}

// Falls back to npm when npm_config_user_agent is absent — the common case for
// users running the installed bin directly rather than through `pnpm exec talkvalue`.
export function detectInstallCommand(pkgName: string, userAgent: string | undefined): string {
  const pm = (userAgent ?? "").split("/")[0];
  switch (pm) {
    case "pnpm":
      return `pnpm add -g ${pkgName}@latest`;
    case "yarn":
      return `yarn global add ${pkgName}@latest`;
    case "bun":
      return `bun add -g ${pkgName}@latest`;
    default:
      return `npm install -g ${pkgName}@latest`;
  }
}

export function createUpdateCommand(dependencies: UpdateCommandDependencies = {}): Command {
  const fetchLatest = dependencies.fetchLatest ?? defaultFetchLatest;
  const currentVersion = dependencies.currentVersion ?? CLI_VERSION;
  const userAgent = dependencies.userAgent ?? process.env.npm_config_user_agent;

  return new Command("update")
    .description("Check whether a newer CLI version is available on npm")
    .action(async (_options: unknown, command: Command) => {
      const formatter = resolveFormatter(command, dependencies);
      const latest = await fetchLatest();

      // semver.gt avoids false positives for pre-releases (e.g. 1.5.0-rc.1) and
      // local dev builds; plain compare is only the fallback for non-semver strings.
      const outdated =
        semver.valid(currentVersion) && semver.valid(latest)
          ? semver.gt(latest, currentVersion)
          : currentVersion !== latest;

      formatter.output(
        {
          current: currentVersion,
          installCommand: outdated ? detectInstallCommand(PKG_NAME, userAgent) : null,
          latest,
          outdated,
        },
        toOutputContext(),
      );
    });
}
