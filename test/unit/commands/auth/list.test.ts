import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/shared/context.js");

import { createAuthListCommand } from "../../../../src/commands/auth/list.js";
import { resolveCommandContext } from "../../../../src/shared/context.js";

const mockResolveCommandContext = vi.mocked(resolveCommandContext);

describe("auth list", () => {
  const mockList = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists all profiles with active indicator", async () => {
    mockResolveCommandContext.mockResolvedValue({
      profile: "ted",
      config: {
        version: 2,
        api_url: "https://api.test.com",
        client_id: "client_123",
        active_profile: "ted",
        profiles: {
          ted: {
            auth_method: "oauth",
            member_email: "ted@example.com",
            org_id: "org_01",
            org_name: "Alpha Corp",
          },
          other: {
            auth_method: "oauth",
            member_email: "other@example.com",
            org_id: "org_02",
            org_name: "Beta Inc",
          },
        },
      },
      formatter: { list: mockList, output: vi.fn(), error: vi.fn() },
      output: {},
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any);

    const cmd = createAuthListCommand();
    await cmd.parseAsync([], { from: "user" });

    expect(mockList).toHaveBeenCalledWith(
      [
        { profile: "ted", orgName: "Alpha Corp", memberEmail: "ted@example.com", active: true },
        { profile: "other", orgName: "Beta Inc", memberEmail: "other@example.com", active: false },
      ],
      expect.any(Array),
      expect.any(Object),
    );
  });

  it("shows empty list when no profiles", async () => {
    mockResolveCommandContext.mockResolvedValue({
      profile: "",
      config: {
        version: 2,
        api_url: "https://api.test.com",
        client_id: "client_123",
        active_profile: "",
        profiles: {},
      },
      formatter: { list: mockList, output: vi.fn(), error: vi.fn() },
      output: {},
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any);

    const cmd = createAuthListCommand();
    await cmd.parseAsync([], { from: "user" });

    expect(mockList).toHaveBeenCalledWith([], expect.any(Array), expect.any(Object));
  });
});
