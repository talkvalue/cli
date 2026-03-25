import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deleteProfile,
  getActiveProfile,
  getProfile,
  listProfiles,
  loadConfig,
  saveConfig,
  setActiveProfile,
  setProfile,
} from "../../../src/config/config.js";
import type { Profile } from "../../../src/config/config.js";
import { ensureConfigDir, getConfigDir, getConfigFilePath } from "../../../src/config/paths.js";

describe("config manager", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let testDir = "";

  beforeEach(async () => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    testDir = await mkdtemp(join(tmpdir(), "talkvalue-config-test-"));
    process.env.XDG_CONFIG_HOME = testDir;
    process.env.HOME = join(testDir, "home");
  });

  afterEach(async () => {
    process.env = originalEnv;

    if (testDir) {
      await rm(testDir, { force: true, recursive: true });
    }
  });

  it("creates and returns default config when file is missing", async () => {
    const config = await loadConfig();

    expect(config).toEqual({
      active_profile: "",
      api_url: "https://api.trytalkvalue.com",
      client_id: "client_01KCTNX7YWPXTWN1AAY74TQC14",
      profiles: {},
      version: 1,
    });

    await expect(access(getConfigFilePath())).resolves.toBeUndefined();
  });

  it("writes and reloads config content", async () => {
    const config = await loadConfig();
    config.api_url = "https://api.staging.talkvalue.com";

    await saveConfig(config);

    const reloaded = await loadConfig();
    expect(reloaded.api_url).toBe("https://api.staging.talkvalue.com");

    const fileContent = await readFile(getConfigFilePath(), "utf8");
    expect(fileContent).toContain("api_url: https://api.staging.talkvalue.com");
  });

  it("sets and gets active profile", async () => {
    await loadConfig();

    await setActiveProfile("dev");

    expect(await getActiveProfile()).toBe("dev");
  });

  it("sets and gets profiles", async () => {
    const profile: Profile = {
      auth_method: "oauth",
      member_email: "dev@talkvalue.com",
      org_id: "org_123",
      org_name: "Dev Org",
    };

    await setProfile("dev", profile);

    expect(await getProfile("dev")).toEqual(profile);
  });

  it("lists profiles", async () => {
    const devProfile: Profile = {
      auth_method: "oauth",
      member_email: "dev@talkvalue.com",
      org_id: "org_dev",
      org_name: "Dev Org",
    };

    const prodProfile: Profile = {
      auth_method: "oauth",
      member_email: "ops@talkvalue.com",
      org_id: "org_prod",
      org_name: "Prod Org",
    };

    await setProfile("dev", devProfile);
    await setProfile("prod", prodProfile);

    expect(await listProfiles()).toEqual(["dev", "prod"]);
  });

  it("deletes a profile", async () => {
    const profile: Profile = {
      auth_method: "oauth",
      member_email: "dev@talkvalue.com",
      org_id: "org_123",
      org_name: "Dev Org",
    };

    await setProfile("dev", profile);
    await deleteProfile("dev");

    expect(await getProfile("dev")).toBeUndefined();
    expect(await listProfiles()).toEqual([]);
  });

  it("saves config file with 0o600 permissions", async () => {
    await loadConfig();
    const configPath = getConfigFilePath();
    const stats = await stat(configPath);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it("creates config directory with 0o700 permissions", async () => {
    await ensureConfigDir();
    const configDir = getConfigDir();
    const stats = await stat(configDir);
    expect(stats.mode & 0o777).toBe(0o700);
  });

  it("creates default config with version 1", async () => {
    const config = await loadConfig();
    expect(config.version).toBe(1);
  });

  it("creates backup when config file is corrupted", async () => {
    await ensureConfigDir();
    const configPath = getConfigFilePath();
    await writeFile(configPath, "invalid: yaml: content: [", "utf8");

    const config = await loadConfig();

    expect(config).toEqual({
      active_profile: "",
      api_url: "https://api.trytalkvalue.com",
      client_id: "client_01KCTNX7YWPXTWN1AAY74TQC14",
      profiles: {},
      version: 1,
    });

    const backupPath = `${configPath}.bak`;
    const backupContent = await readFile(backupPath, "utf8");
    expect(backupContent).toBe("invalid: yaml: content: [");
  });
});
