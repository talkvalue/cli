import { chmod, readFile, rename, unlink, writeFile } from "node:fs/promises";

import YAML from "yaml";

import { ensureConfigDir, getConfigFilePath } from "./paths.js";

export interface Config {
  version: number;
  api_url: string;
  client_id: string;
  active_profile: string;
  profiles: Record<string, Profile>;
}

export interface Profile {
  org_id: string;
  org_name: string;
  member_email: string;
  auth_method: "oauth";
}

const DEFAULT_CONFIG: Config = {
  version: 1,
  api_url: "https://api.trytalkvalue.com",
  client_id: "client_01KCTNX7YWPXTWN1AAY74TQC14",
  active_profile: "",
  profiles: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function parseProfile(value: unknown): Profile | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const orgId = value.org_id;
  const orgName = value.org_name;
  const memberEmail = value.member_email;
  const authMethod = value.auth_method;

  if (
    typeof orgId !== "string" ||
    typeof orgName !== "string" ||
    typeof memberEmail !== "string" ||
    authMethod !== "oauth"
  ) {
    return undefined;
  }

  return {
    org_id: orgId,
    org_name: orgName,
    member_email: memberEmail,
    auth_method: authMethod,
  };
}

function parseProfiles(value: unknown): Record<string, Profile> {
  if (!isRecord(value)) {
    return {};
  }

  const profiles: Record<string, Profile> = {};

  for (const [profileName, profileValue] of Object.entries(value)) {
    const parsedProfile = parseProfile(profileValue);

    if (parsedProfile) {
      profiles[profileName] = parsedProfile;
    }
  }

  return profiles;
}

function normalizeConfig(value: unknown): Config {
  if (!isRecord(value)) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    version: parseNumber(value.version, DEFAULT_CONFIG.version),
    api_url: parseString(value.api_url, DEFAULT_CONFIG.api_url),
    client_id: parseString(value.client_id, DEFAULT_CONFIG.client_id),
    active_profile: parseString(value.active_profile, DEFAULT_CONFIG.active_profile),
    profiles: parseProfiles(value.profiles),
  };
}

function createTempFilePath(configFilePath: string): string {
  return `${configFilePath}.${process.pid}.${Date.now()}.tmp`;
}

export async function loadConfig(): Promise<Config> {
  const configFilePath = getConfigFilePath();

  try {
    const fileContent = await readFile(configFilePath, "utf8");
    const parsed = YAML.parse(fileContent);
    return normalizeConfig(parsed);
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;

    if (code === "ENOENT") {
      const defaultConfig = { ...DEFAULT_CONFIG };
      await saveConfig(defaultConfig);
      return defaultConfig;
    }

    throw error;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  const configFilePath = getConfigFilePath();
  const tempFilePath = createTempFilePath(configFilePath);
  const yamlContent = YAML.stringify(config);

  await writeFile(tempFilePath, yamlContent, { encoding: "utf8", mode: 0o600 });

  try {
    await rename(tempFilePath, configFilePath);
    await chmod(configFilePath, 0o600);
  } catch (error) {
    await unlink(tempFilePath).catch(() => undefined);
    throw error;
  }
}

export async function getActiveProfile(): Promise<string> {
  const config = await loadConfig();
  return config.active_profile;
}

export async function setActiveProfile(profileName: string): Promise<void> {
  const config = await loadConfig();
  config.active_profile = profileName;
  await saveConfig(config);
}

export async function getProfile(profileName: string): Promise<Profile | undefined> {
  const config = await loadConfig();
  return config.profiles[profileName];
}

export async function setProfile(profileName: string, profile: Profile): Promise<void> {
  const config = await loadConfig();
  config.profiles[profileName] = profile;
  await saveConfig(config);
}

export async function listProfiles(): Promise<string[]> {
  const config = await loadConfig();
  return Object.keys(config.profiles);
}

export async function deleteProfile(profileName: string): Promise<void> {
  const config = await loadConfig();
  delete config.profiles[profileName];

  if (config.active_profile === profileName) {
    config.active_profile = "";
  }

  await saveConfig(config);
}

export async function createProfile(name: string, profile: Profile): Promise<Config> {
  const config = await loadConfig();
  config.profiles[name] = profile;
  config.active_profile = name;
  await saveConfig(config);
  return config;
}
