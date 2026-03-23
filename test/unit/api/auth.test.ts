import { describe, expect, it, vi } from "vitest";
import { getAuthOverview, getOrganizations } from "../../../src/api/auth.js";
import type { ApiClient } from "../../../src/api/client.js";
import type { AuthOverviewRes } from "../../../src/api/generated/index.js";

describe("getAuthOverview", () => {
  it("should fetch auth overview from the correct endpoint", async () => {
    const mockRes: AuthOverviewRes = {
      teamMemberCount: 5,
      memberFirstName: "John",
    };

    const client = {
      get: vi.fn().mockResolvedValue(mockRes),
    } as unknown as ApiClient;

    const result = await getAuthOverview(client);

    expect(client.get).toHaveBeenCalledWith("/auth/overview");
    expect(result).toEqual(mockRes);
  });
});

describe("getOrganizations", () => {
  it("returns organization list", async () => {
    const mockClient = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: "org_01", name: "Alpha Corp" },
          { id: "org_02", name: "Beta Inc" },
        ],
      }),
    };

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await getOrganizations(mockClient as any);
    expect(result).toEqual([
      { id: "org_01", name: "Alpha Corp" },
      { id: "org_02", name: "Beta Inc" },
    ]);
    expect(mockClient.get).toHaveBeenCalledWith("/auth/organizations");
  });
});
