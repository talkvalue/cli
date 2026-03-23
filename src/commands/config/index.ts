import { Command } from "commander";

import { loadConfig, saveConfig } from "../../config/index.js";
import type { Config } from "../../config/index.js";
import { UsageError } from "../../errors/index.js";
import { createFormatter, detectFormat } from "../../output/index.js";
import type { OutputContext } from "../../output/index.js";

function createOutputContext(): OutputContext {
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAtPath(source: Config, path: string): unknown {
  let current: unknown = source;

  for (const segment of path.split(".")) {
    if (!isRecord(current) || !(segment in current)) {
      throw new UsageError(`Unknown config key: ${path}`);
    }

    current = current[segment];
  }

  return current;
}

function setAtPath(source: Config, path: string, value: string): void {
  const segments = path.split(".");
  let current: unknown = source;

  for (const segment of segments.slice(0, -1)) {
    if (!isRecord(current)) {
      throw new UsageError(`Cannot set nested key under non-object at: ${path}`);
    }

    let next = current[segment];

    if (next === undefined || !isRecord(next)) {
      next = {};
      current[segment] = next;
    }

    current = next;
  }

  const lastSegment = segments.at(-1);

  if (!lastSegment || !isRecord(current)) {
    throw new UsageError(`Invalid config key: ${path}`);
  }

  current[lastSegment] = value;
}

async function outputConfigValue(key: string, command: Command): Promise<void> {
  const globals = command.optsWithGlobals<{ format?: string }>();
  const formatter = createFormatter(detectFormat(globals.format));
  const config = await loadConfig();
  const value = getAtPath(config, key);

  formatter.output({ key, value }, createOutputContext());
}

async function setConfigValue(key: string, value: string, command: Command): Promise<void> {
  const globals = command.optsWithGlobals<{ format?: string }>();
  const formatter = createFormatter(detectFormat(globals.format));
  const config = await loadConfig();

  setAtPath(config, key, value);
  await saveConfig(config);

  formatter.output({ key, value }, createOutputContext());
}

async function listConfig(command: Command): Promise<void> {
  const globals = command.optsWithGlobals<{ format?: string }>();
  const formatter = createFormatter(detectFormat(globals.format));
  const config = await loadConfig();

  formatter.output({ ...config }, createOutputContext());
}

export function createConfigCommand(): Command {
  const configCommand = new Command("config").description("Manage CLI configuration");

  configCommand
    .command("get")
    .argument("<key>")
    .description("Get a config value")
    .action(async (key: string, _options: unknown, command: Command) => {
      await outputConfigValue(key, command);
    });

  configCommand
    .command("set")
    .argument("<key>")
    .argument("<value>")
    .description("Set a config value")
    .action(async (key: string, value: string, _options: unknown, command: Command) => {
      await setConfigValue(key, value, command);
    });

  configCommand
    .command("list")
    .description("List config values")
    .action(async (_options: unknown, command: Command) => {
      await listConfig(command);
    });

  return configCommand;
}
