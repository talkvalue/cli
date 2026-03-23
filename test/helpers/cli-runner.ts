import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import YAML from "yaml";

const execFileAsync = promisify(execFile);

const CLI_ENTRY = "dist/cli.js";
const TEMP_DIR_PREFIX = "talkvalue-cli-test-";
const CLI_TIMEOUT_MS = 15_000;
const PROJECT_ROOT = process.cwd();
let buildOncePromise: Promise<void> | undefined;

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TestEnvironment {
  configHome: string;
  configDir: string;
  configFilePath: string;
}

export interface RunOptions {
  env?: Record<string, string>;
  timeout?: number;
}

interface ConfigOverrides {
  active_profile?: string;
  api_url?: string;
  profiles?: Record<string, unknown>;
}

function buildEnv(testEnv: TestEnvironment, extra?: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NO_COLOR: "1",
    XDG_CONFIG_HOME: testEnv.configHome,
    ...extra,
  };
}

async function ensureBuilt(): Promise<void> {
  if (!buildOncePromise) {
    const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

    buildOncePromise = execFileAsync(pnpmCommand, ["run", "build"], {
      cwd: PROJECT_ROOT,
      env: process.env,
    }).then(() => undefined);
  }

  await buildOncePromise;
}

function buildConfigYaml(overrides: ConfigOverrides): string {
  const config = {
    version: 1,
    api_url: overrides.api_url ?? "https://api.trytalkvalue.com",
    client_id: "client_01KCTNX7YWPXTWN1AAY74TQC14",
    active_profile: overrides.active_profile ?? "",
    profiles: overrides.profiles ?? {},
  };

  return YAML.stringify(config);
}

export async function runCli(
  args: string[],
  testEnv: TestEnvironment,
  options?: RunOptions,
): Promise<CliResult> {
  await ensureBuilt();

  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI_ENTRY, ...args], {
      cwd: PROJECT_ROOT,
      env: buildEnv(testEnv, options?.env),
      timeout: options?.timeout ?? CLI_TIMEOUT_MS,
    });

    return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { code?: number; stderr?: string; stdout?: string };

    return {
      exitCode: execError.code ?? 1,
      stderr: execError.stderr ?? "",
      stdout: execError.stdout ?? "",
    };
  }
}

export async function createTestEnvironment(
  configOverrides?: ConfigOverrides,
): Promise<TestEnvironment> {
  const configHome = await mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX));
  const configDir = join(configHome, "talkvalue");
  const configFilePath = join(configDir, "config.yml");

  await mkdir(configDir, { recursive: true });
  await writeFile(configFilePath, buildConfigYaml(configOverrides ?? {}), "utf8");

  return { configHome, configDir, configFilePath };
}

export async function cleanupTestEnvironment(testEnv: TestEnvironment): Promise<void> {
  await rm(testEnv.configHome, { force: true, recursive: true });
}
