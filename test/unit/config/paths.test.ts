import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureConfigDir, getConfigDir, getConfigFilePath } from "../../../src/config/paths.js";

describe("config paths", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let testDir = "";

  beforeEach(async () => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    testDir = await mkdtemp(join(tmpdir(), "talkvalue-paths-test-"));
  });

  afterEach(async () => {
    process.env = originalEnv;

    if (testDir) {
      await rm(testDir, { force: true, recursive: true });
    }
  });

  it("uses HOME/.talkvalue when XDG_CONFIG_HOME is not set", () => {
    process.env.XDG_CONFIG_HOME = undefined;
    process.env.HOME = testDir;

    expect(getConfigDir()).toBe(join(testDir, ".talkvalue"));
  });

  it("uses XDG_CONFIG_HOME/talkvalue when XDG_CONFIG_HOME is set", () => {
    process.env.XDG_CONFIG_HOME = join(testDir, "xdg");
    process.env.HOME = join(testDir, "home");

    expect(getConfigDir()).toBe(join(testDir, "xdg", "talkvalue"));
  });

  it("returns config.yml path inside the config dir", () => {
    process.env.XDG_CONFIG_HOME = undefined;
    process.env.HOME = testDir;

    expect(getConfigFilePath()).toBe(join(testDir, ".talkvalue", "config.yml"));
  });

  it("creates the config directory recursively", async () => {
    process.env.XDG_CONFIG_HOME = join(testDir, "nested", "config-home");

    const createdDir = await ensureConfigDir();

    expect(createdDir).toBe(join(testDir, "nested", "config-home", "talkvalue"));
    await expect(access(createdDir)).resolves.toBeUndefined();
  });
});
