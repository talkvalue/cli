import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram, main } from "../../src/cli.js";

function captureStdout(): { chunks: string[]; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });

  return {
    chunks,
    restore: () => spy.mockRestore(),
  };
}

describe("cli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("registers top-level command groups", () => {
    const program = createProgram();
    const names = program.commands.map((command) => command.name());

    expect(names).toEqual(["auth", "path", "config", "version"]);
  });

  it("prints version command output through main", async () => {
    const stdout = captureStdout();

    await main(["node", "talkvalue", "--format", "json", "version"]);

    stdout.restore();
    const parsed = JSON.parse(stdout.chunks.join("")) as {
      data: { version: string };
    };

    expect(parsed.data.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
