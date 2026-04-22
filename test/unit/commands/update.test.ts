import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PKG_NAME,
  createUpdateCommand,
  detectInstallCommand,
} from "../../../src/commands/update.js";
import { CliError } from "../../../src/errors/index.js";
import type { Formatter } from "../../../src/output/index.js";
import * as sharedModule from "../../../src/shared/context.js";

vi.mock("../../../src/shared/context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/shared/context.js")>();
  return {
    ...actual,
    ensureAuth: vi.fn().mockResolvedValue(undefined),
    requireAuth: vi.fn(),
    resolveCommandContext: vi.fn(),
  };
});

interface FormatterDouble extends Formatter {
  error: ReturnType<typeof vi.fn<Formatter["error"]>>;
  list: ReturnType<typeof vi.fn<Formatter["list"]>>;
  output: ReturnType<typeof vi.fn<Formatter["output"]>>;
}

function createFormatterDouble(): FormatterDouble {
  return {
    error: vi.fn<Formatter["error"]>(),
    list: vi.fn<Formatter["list"]>(),
    output: vi.fn<Formatter["output"]>(),
  };
}

interface RunOptions {
  currentVersion?: string;
  fetchLatest?: () => Promise<string>;
  userAgent?: string;
}

interface CommandHarness {
  formatter: FormatterDouble;
  run: (argv: string[], options: RunOptions) => Promise<void>;
}

function createHarness(): CommandHarness {
  const formatter = createFormatterDouble();
  return {
    formatter,
    run: async (argv, options) => {
      const command = createUpdateCommand({
        currentVersion: options.currentVersion,
        fetchLatest: options.fetchLatest,
        formatter,
        userAgent: options.userAgent,
      });
      command.exitOverride();
      const program = new Command();
      program.exitOverride();
      program.addCommand(command);
      await program.parseAsync(["update", ...argv], { from: "user" });
    },
  };
}

function lastPayload(formatter: FormatterDouble): Record<string, unknown> {
  const calls = formatter.output.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, unknown>;
}

describe("createUpdateCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports outdated when a newer version is published", async () => {
    const harness = createHarness();
    await harness.run([], {
      currentVersion: "1.4.1",
      fetchLatest: async () => "1.5.0",
      userAgent: "", // force default-npm path; vitest may inherit pnpm/yarn UA
    });

    const payload = lastPayload(harness.formatter);
    expect(payload.current).toBe("1.4.1");
    expect(payload.latest).toBe("1.5.0");
    expect(payload.outdated).toBe(true);
    expect(payload.installCommand).toBe(`npm install -g ${PKG_NAME}@latest`);
  });

  it("reports up-to-date when versions match", async () => {
    const harness = createHarness();
    await harness.run([], {
      currentVersion: "1.5.0",
      fetchLatest: async () => "1.5.0",
    });

    const payload = lastPayload(harness.formatter);
    expect(payload.outdated).toBe(false);
    expect(payload.installCommand).toBeNull();
  });

  it("reports up-to-date when current is a pre-release ahead of latest", async () => {
    const harness = createHarness();
    await harness.run([], {
      currentVersion: "1.5.0-rc.1",
      fetchLatest: async () => "1.4.1",
    });

    const payload = lastPayload(harness.formatter);
    expect(payload.outdated).toBe(false);
    expect(payload.installCommand).toBeNull();
  });

  it("propagates CliError from fetchLatest", async () => {
    const harness = createHarness();
    await expect(
      harness.run([], {
        fetchLatest: async () => {
          throw new CliError("network unreachable");
        },
      }),
    ).rejects.toBeInstanceOf(CliError);
  });

  it("emits a pnpm install command when running under pnpm", async () => {
    const harness = createHarness();
    await harness.run([], {
      currentVersion: "1.4.1",
      fetchLatest: async () => "1.5.0",
      userAgent: "pnpm/9.0.0 npm/? node/v24.0.0",
    });

    expect(lastPayload(harness.formatter).installCommand).toBe(`pnpm add -g ${PKG_NAME}@latest`);
  });
});

describe("detectInstallCommand", () => {
  it.each([
    ["pnpm/9.0.0", "pnpm add -g @talkvalue/cli@latest"],
    ["yarn/1.22.0", "yarn global add @talkvalue/cli@latest"],
    ["bun/1.0.0", "bun add -g @talkvalue/cli@latest"],
    ["npm/10.0.0", "npm install -g @talkvalue/cli@latest"],
    [undefined, "npm install -g @talkvalue/cli@latest"],
    ["", "npm install -g @talkvalue/cli@latest"],
    ["unknown-pm/1.0.0", "npm install -g @talkvalue/cli@latest"],
  ])("maps user agent %j to %s", (ua, expected) => {
    expect(detectInstallCommand(PKG_NAME, ua)).toBe(expected);
  });
});
