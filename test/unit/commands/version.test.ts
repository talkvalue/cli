import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVersionCommand } from "../../../src/commands/version.js";

function createRoot(): Command {
  return new Command()
    .version("0.1.0")
    .option("--format <format>")
    .addCommand(createVersionCommand());
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

describe("version command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs version metadata", async () => {
    const stdout = captureStdout();

    await createRoot().parseAsync(["node", "test", "--format", "json", "version"]);

    stdout.restore();
    const parsed = JSON.parse(stdout.output.join("")) as {
      data: { nodeVersion: string; platform: string; version: string };
    };

    expect(parsed.data.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(parsed.data.nodeVersion).toBe(process.version);
    expect(parsed.data.platform).toBe(process.platform);
  });
});
