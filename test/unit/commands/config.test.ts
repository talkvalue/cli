import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConfigCommand } from "../../../src/commands/config/index.js";
import * as configModule from "../../../src/config/config.js";
import { UsageError } from "../../../src/errors/index.js";

function createRoot(): Command {
  return new Command().option("--format <format>").addCommand(createConfigCommand());
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

describe("config commands", () => {
  const mockConfig = {
    active_profile: "dev",
    api_url: "https://api.trytalkvalue.com",
    client_id: "client_01KCTNX7YWPXTWN1AAY74TQC14",
    profiles: {
      dev: {
        auth_method: "oauth" as const,
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
    const stdout = captureStdout();

    await createRoot().parseAsync(["node", "test", "--format", "json", "config", "get", "api_url"]);

    stdout.restore();
    const parsed = JSON.parse(stdout.output.join("")) as { data: { key: string; value: string } };
    expect(parsed.data).toEqual({ key: "api_url", value: "https://api.trytalkvalue.com" });
  });

  it("config set profiles sub-key rejects with UsageError", async () => {
    const promise = createRoot().parseAsync([
      "node",
      "test",
      "--format",
      "json",
      "config",
      "set",
      "profiles.dev.org_id",
      "org_new",
    ]);

    await expect(promise).rejects.toBeInstanceOf(UsageError);
    await expect(promise).rejects.toThrow("managed config field");
  });

  it("config set api_url with valid URL stores correctly", async () => {
    const saveConfigSpy = vi.spyOn(configModule, "saveConfig").mockResolvedValue(undefined);
    const stdout = captureStdout();

    await createRoot().parseAsync([
      "node",
      "test",
      "--format",
      "json",
      "config",
      "set",
      "api_url",
      "https://api.example.com",
    ]);

    stdout.restore();
    expect(saveConfigSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdout.output.join("")) as { data: { key: string; value: string } };
    expect(parsed.data).toEqual({ key: "api_url", value: "https://api.example.com" });
  });

  it("config set version rejects with UsageError", async () => {
    const stdout = captureStdout();

    const promise = createRoot().parseAsync([
      "node",
      "test",
      "--format",
      "json",
      "config",
      "set",
      "version",
      "2",
    ]);

    await expect(promise).rejects.toBeInstanceOf(UsageError);
    await expect(promise).rejects.toThrow("managed config field");
    stdout.restore();
  });

  it("config set profiles rejects with UsageError", async () => {
    const stdout = captureStdout();

    const promise = createRoot().parseAsync([
      "node",
      "test",
      "--format",
      "json",
      "config",
      "set",
      "profiles",
      "{}",
    ]);

    await expect(promise).rejects.toBeInstanceOf(UsageError);
    await expect(promise).rejects.toThrow("managed config field");
    stdout.restore();
  });

  it("config set unknown_key rejects with UsageError", async () => {
    const stdout = captureStdout();

    const promise = createRoot().parseAsync([
      "node",
      "test",
      "--format",
      "json",
      "config",
      "set",
      "foo",
      "bar",
    ]);

    await expect(promise).rejects.toBeInstanceOf(UsageError);
    await expect(promise).rejects.toThrow('Unknown config key "foo"');
    stdout.restore();
  });

  it("lists config values", async () => {
    const stdout = captureStdout();

    await createRoot().parseAsync(["node", "test", "--format", "json", "config", "list"]);

    stdout.restore();
    const parsed = JSON.parse(stdout.output.join("")) as { data: typeof mockConfig };
    expect(parsed.data.active_profile).toBe("dev");
  });
});
