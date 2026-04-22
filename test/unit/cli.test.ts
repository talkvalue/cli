import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  let originalListeners: Record<string, unknown[]>;

  beforeEach(() => {
    originalListeners = {
      SIGINT: process.listeners("SIGINT"),
      SIGTERM: process.listeners("SIGTERM"),
    };
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
    for (const listener of originalListeners.SIGINT) {
      process.on("SIGINT", listener as NodeJS.SignalsListener);
    }
    for (const listener of originalListeners.SIGTERM) {
      process.on("SIGTERM", listener as NodeJS.SignalsListener);
    }
  });

  it("registers top-level command groups", () => {
    const program = createProgram();
    const names = program.commands.map((command) => command.name());

    expect(names).toEqual(["auth", "path", "config", "update", "version"]);
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

  it("registers SIGINT handler with exit code 130", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit called");
    });

    await main(["node", "talkvalue", "--format", "json", "version"]).catch(() => undefined);

    const sigintListeners = process.listeners("SIGINT");
    expect(sigintListeners.length).toBeGreaterThan(0);

    process.exitCode = 0;
    try {
      (sigintListeners[0] as () => void)();
    } catch {
      // exit() throws in test
    }

    expect(process.exitCode).toBe(130);
    exitSpy.mockRestore();
  });

  it("registers SIGTERM handler with exit code 143", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit called");
    });

    await main(["node", "talkvalue", "--format", "json", "version"]).catch(() => undefined);

    const sigTermListeners = process.listeners("SIGTERM");
    expect(sigTermListeners.length).toBeGreaterThan(0);

    process.exitCode = 0;
    try {
      (sigTermListeners[0] as () => void)();
    } catch {
      // exit() throws in test
    }

    expect(process.exitCode).toBe(143);
    exitSpy.mockRestore();
  });
});
