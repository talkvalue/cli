import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Tag } from "../../../../src/api/generated/path/sdk.gen.js";
import { createTagCommand } from "../../../../src/commands/path/tag.js";
import { UsageError } from "../../../../src/errors/index.js";
import type { Formatter } from "../../../../src/output/index.js";
import * as sharedModule from "../../../../src/shared/context.js";

vi.mock("../../../../src/shared/context.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/shared/context.js")>();
  return {
    ...actual,
    ensureAuth: vi.fn().mockResolvedValue(undefined),
    requireAuth: vi.fn(),
    resolveCommandContext: vi.fn(),
  };
});

vi.mock("../../../../src/api/generated/path/sdk.gen.js", () => ({
  Tag: {
    attachTagToSource: vi.fn(),
    createTag: vi.fn(),
    deleteTag: vi.fn(),
    detachTagFromSource: vi.fn(),
    listTags: vi.fn(),
    updateTag: vi.fn(),
  },
}));

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

interface CommandHarness {
  formatter: FormatterDouble;
  run: (argv: string[]) => Promise<void>;
}

function createHarness(): CommandHarness {
  const formatter = createFormatterDouble();
  vi.mocked(sharedModule.ensureAuth).mockResolvedValue(undefined);

  const command = createTagCommand({ formatter });
  command.exitOverride();
  const program = new Command();
  program.exitOverride();
  program.addCommand(command);

  return {
    formatter,
    run: async (argv) => {
      await program.parseAsync(["tag", ...argv], { from: "user" });
    },
  };
}

describe("createTagCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list calls SDK without name filter by default", async () => {
    const harness = createHarness();
    vi.mocked(Tag.listTags).mockResolvedValueOnce({
      data: [{ id: 1, name: "vip" }],
    } as any);

    await harness.run(["list"]);

    expect(Tag.listTags).toHaveBeenCalledWith({ query: { name: undefined } });
    expect(harness.formatter.list).toHaveBeenCalledTimes(1);
  });

  it("list forwards --name filter", async () => {
    const harness = createHarness();
    vi.mocked(Tag.listTags).mockResolvedValueOnce({
      data: [],
    } as any);

    await harness.run(["list", "--name", "vip"]);

    expect(Tag.listTags).toHaveBeenCalledWith({ query: { name: "vip" } });
  });

  it("create requires --name", async () => {
    const harness = createHarness();
    await expect(harness.run(["create"])).rejects.toBeInstanceOf(UsageError);
    expect(Tag.createTag).not.toHaveBeenCalled();
  });

  it("create calls SDK with name", async () => {
    const harness = createHarness();
    vi.mocked(Tag.createTag).mockResolvedValueOnce({
      data: { id: 5, name: "vip" },
    } as any);

    await harness.run(["create", "--name", "vip"]);

    expect(Tag.createTag).toHaveBeenCalledWith({ body: { name: "vip" } });
    expect(harness.formatter.output).toHaveBeenCalledTimes(1);
  });

  it("update requires --name", async () => {
    const harness = createHarness();
    await expect(harness.run(["update", "5"])).rejects.toBeInstanceOf(UsageError);
    expect(Tag.updateTag).not.toHaveBeenCalled();
  });

  it("update calls SDK with id and name", async () => {
    const harness = createHarness();
    vi.mocked(Tag.updateTag).mockResolvedValueOnce({
      data: { id: 5, name: "renamed" },
    } as any);

    await harness.run(["update", "5", "--name", "renamed"]);

    expect(Tag.updateTag).toHaveBeenCalledWith({
      body: { name: "renamed" },
      path: { id: 5 },
    });
  });

  it("delete requires --confirm", async () => {
    const harness = createHarness();
    await expect(harness.run(["delete", "5"])).rejects.toBeInstanceOf(UsageError);
    expect(Tag.deleteTag).not.toHaveBeenCalled();
  });

  it("delete calls SDK with id when confirmed", async () => {
    const harness = createHarness();
    vi.mocked(Tag.deleteTag).mockResolvedValueOnce({} as any);

    await harness.run(["delete", "5", "--confirm"]);

    expect(Tag.deleteTag).toHaveBeenCalledWith({ path: { id: 5 } });
    expect(harness.formatter.output).toHaveBeenCalledWith(
      { deleted: true, id: 5 },
      expect.anything(),
    );
  });

  it("attach requires --tag-id or --name", async () => {
    const harness = createHarness();
    await expect(harness.run(["attach", "10"])).rejects.toBeInstanceOf(UsageError);
    expect(Tag.attachTagToSource).not.toHaveBeenCalled();
  });

  it("attach calls SDK with --tag-id", async () => {
    const harness = createHarness();
    vi.mocked(Tag.attachTagToSource).mockResolvedValueOnce({
      data: { id: 3, name: "vip" },
    } as any);

    await harness.run(["attach", "10", "--tag-id", "3"]);

    expect(Tag.attachTagToSource).toHaveBeenCalledWith({
      body: { tagId: 3 },
      path: { sourceId: 10 },
    });
  });

  it("attach calls SDK with --name", async () => {
    const harness = createHarness();
    vi.mocked(Tag.attachTagToSource).mockResolvedValueOnce({
      data: { id: 4, name: "newtag" },
    } as any);

    await harness.run(["attach", "10", "--name", "newtag"]);

    expect(Tag.attachTagToSource).toHaveBeenCalledWith({
      body: { name: "newtag" },
      path: { sourceId: 10 },
    });
  });

  it("detach calls SDK with sourceId and tagId", async () => {
    const harness = createHarness();
    vi.mocked(Tag.detachTagFromSource).mockResolvedValueOnce({} as any);

    await harness.run(["detach", "10", "--tag-id", "3"]);

    expect(Tag.detachTagFromSource).toHaveBeenCalledWith({
      path: { sourceId: 10, tagId: 3 },
    });
    expect(harness.formatter.output).toHaveBeenCalledWith(
      { detached: true, sourceId: 10, tagId: 3 },
      expect.anything(),
    );
  });
});
