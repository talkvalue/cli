import { describe, expect, it, vi } from "vitest";

vi.mock("@inquirer/select", () => ({ default: vi.fn() }));

import select from "@inquirer/select";
import { selectOrganization } from "../../../src/shared/prompt.js";

interface Organization {
  id: string;
  name: string;
}

const orgs: Organization[] = [
  { id: "org_01", name: "Alpha Corp" },
  { id: "org_02", name: "Beta Inc" },
];

describe("selectOrganization", () => {
  it("returns the only org when list has one entry", async () => {
    const result = await selectOrganization([orgs[0]]);
    expect(result).toEqual(orgs[0]);
  });

  it("matches by name (case-insensitive)", async () => {
    const result = await selectOrganization(orgs, "alpha corp");
    expect(result).toEqual(orgs[0]);
  });

  it("matches by id", async () => {
    const result = await selectOrganization(orgs, "org_02");
    expect(result).toEqual(orgs[1]);
  });

  it("throws UsageError when no match found", async () => {
    await expect(selectOrganization(orgs, "nonexistent")).rejects.toThrow(
      "No organization matching",
    );
  });

  it("throws UsageError when multiple orgs and no TTY", async () => {
    await expect(selectOrganization(orgs, undefined, { isTTY: false })).rejects.toThrow(
      "Multiple organizations",
    );
  });

  it("throws UsageError when no organizations available", async () => {
    await expect(selectOrganization([])).rejects.toThrow("No organizations available");
  });

  it("calls select with correct choices in interactive mode", async () => {
    vi.mocked(select).mockResolvedValueOnce(orgs[1]);

    const result = await selectOrganization(orgs, undefined, { isTTY: true });

    expect(result).toEqual(orgs[1]);
    expect(select).toHaveBeenCalledWith({
      message: "Select an organization",
      choices: [
        { name: "Alpha Corp", value: orgs[0], description: "org_01" },
        { name: "Beta Inc", value: orgs[1], description: "org_02" },
      ],
    });
  });
});
