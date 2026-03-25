import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConfigCommand } from "../../../src/commands/config/index.js";
import type { Config } from "../../../src/config/index.js";
import * as configModule from "../../../src/config/index.js";
import { UsageError } from "../../../src/errors/index.js";

interface CommandHarness {
  run: (argv: string[]) => Promise<void>;
}

function createRoot(): Command {
  return new Command().option("--format <format>").addCommand(createConfigCommand());
}

function createHarness(): CommandHarness {
  const root = createRoot();

  return {
    run: async (argv: string[]): Promise<void> => {
      await root.parseAsync(["node", "test", "--format", "json", "config", ...argv]);
    },
  };
}

function captureStdout(): { output: string[]; restore: () => void } {
  const output: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    output.push(String(chunk));
    return true;
  });

  return {
    output,
    restore: () => spy.mockRestore(),
  };
}

describe("createConfigCommand", () => {
  const mockConfig: Config = {
    active_profile: "dev",
    api_url: "https://api.trytalkvalue.com",
    client_id: "client_01KCTNX7YWPXTWN1AAY74TQC14",
    profiles: {
      dev: {
        auth_method: "oauth",
        member_email: "dev@example.com",
        org_id: "org_dev",
        org_name: "Dev Org",
      },
    },
    version: 1,
  };

  beforeEach(() => {
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(structuredClone(mockConfig));
    vi.spyOn(configModule, "saveConfig").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("gets a top-level config value", async () => {
    const harness = createHarness();
    const stdout = captureStdout();

    await harness.run(["get", "api_url"]);

    stdout.restore();
    expect(configModule.loadConfig).toHaveBeenCalledTimes(1);
    expect(configModule.saveConfig).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout.output.join("")) as { data: { key: string; value: string } };
    expect(parsed.data).toEqual({ key: "api_url", value: "https://api.trytalkvalue.com" });
  });

  it("gets a nested config value", async () => {
    const harness = createHarness();
    const stdout = captureStdout();

    await harness.run(["get", "profiles.dev.org_id"]);

    stdout.restore();
    const parsed = JSON.parse(stdout.output.join("")) as { data: { key: string; value: string } };
    expect(parsed.data).toEqual({ key: "profiles.dev.org_id", value: "org_dev" });
  });

  it("throws UsageError for unknown key in config get", async () => {
    const harness = createHarness();

    await expect(harness.run(["get", "missing.key"])).rejects.toBeInstanceOf(UsageError);
    await expect(harness.run(["get", "missing.key"])).rejects.toThrow(
      "Unknown config key: missing.key",
    );
  });

  it("sets api_url and saves updated config", async () => {
    const harness = createHarness();
    const saveConfigSpy = vi.spyOn(configModule, "saveConfig").mockResolvedValue(undefined);
    const stdout = captureStdout();

    await harness.run(["set", "api_url", "https://api.example.com"]);

    stdout.restore();
    expect(configModule.loadConfig).toHaveBeenCalledTimes(1);
    expect(saveConfigSpy).toHaveBeenCalledTimes(1);
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({ api_url: "https://api.example.com" }),
    );

    const parsed = JSON.parse(stdout.output.join("")) as { data: { key: string; value: string } };
    expect(parsed.data).toEqual({ key: "api_url", value: "https://api.example.com" });
  });

  it("sets nested settable key under active_profile", async () => {
    const harness = createHarness();
    const saveConfigSpy = vi.spyOn(configModule, "saveConfig").mockResolvedValue(undefined);

    await harness.run(["set", "active_profile.name", "next-dev"]);

    expect(saveConfigSpy).toHaveBeenCalledTimes(1);
    expect(saveConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        active_profile: expect.objectContaining({ name: "next-dev" }),
      }),
    );
  });

  it("rejects managed key version in config set", async () => {
    const harness = createHarness();

    await expect(harness.run(["set", "version", "2"])).rejects.toBeInstanceOf(UsageError);
    await expect(harness.run(["set", "version", "2"])).rejects.toThrow(
      '"version" is a managed config field and cannot be set directly.',
    );
  });

  it("rejects managed profiles subtree in config set", async () => {
    const harness = createHarness();

    await expect(harness.run(["set", "profiles.dev.org_id", "org_new"])).rejects.toBeInstanceOf(
      UsageError,
    );
    await expect(harness.run(["set", "profiles.dev.org_id", "org_new"])).rejects.toThrow(
      '"profiles" is a managed config field and cannot be set directly.',
    );
  });

  it("rejects unknown key in config set", async () => {
    const harness = createHarness();

    await expect(harness.run(["set", "foo", "bar"])).rejects.toBeInstanceOf(UsageError);
    await expect(harness.run(["set", "foo", "bar"])).rejects.toThrow(
      'Unknown config key "foo". Settable keys: api_url, client_id, active_profile',
    );
  });

  it("lists config values", async () => {
    const harness = createHarness();
    const stdout = captureStdout();

    await harness.run(["list"]);

    stdout.restore();
    expect(configModule.loadConfig).toHaveBeenCalledTimes(1);
    expect(configModule.saveConfig).not.toHaveBeenCalled();
    const parsed = JSON.parse(stdout.output.join("")) as { data: Config };
    expect(parsed.data).toMatchObject({
      active_profile: "dev",
      api_url: "https://api.trytalkvalue.com",
      client_id: "client_01KCTNX7YWPXTWN1AAY74TQC14",
      version: 1,
    });
  });
});
