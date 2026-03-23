import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export function getConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;

  if (xdgConfigHome) {
    return join(xdgConfigHome, "talkvalue");
  }

  return join(process.env.HOME ?? homedir(), ".talkvalue");
}

export function getConfigFilePath(): string {
  return join(getConfigDir(), "config.yml");
}

export async function ensureConfigDir(): Promise<string> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  return configDir;
}
