import { describe, expect, it } from "vitest";
import type { ApiClient, RequestOptions } from "../../../src/api/client.js";
import type {
  ChannelRes,
  CreateChannelReq,
  CreatePersonReq,
  PathOverviewRes,
  PathOverviewStatsRes,
  PersonActivityParams,
  PersonActivityRes,
  PersonDetailRes,
  PersonFilterParams,
  PersonPageRes,
  UpdateChannelReq,
  UpdatePersonReq,
} from "../../../src/api/generated/index.js";
import {
  addPersonToChannel,
  createChannel,
  deleteChannel,
  deletePerson,
  exportChannelPeople,
  exportPersons,
  getChannel,
  getOverview,
  getOverviewStats,
  getPerson,
  getPersonActivity,
  listChannelPeople,
  listChannels,
  listPersons,
  mergePersons,
  updateChannel,
  updatePerson,
} from "../../../src/api/path.js";

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

interface CallRecord {
  method: HttpMethod;
  options?: RequestOptions | Omit<RequestOptions, "body">;
  path: string;
}

interface MockApiClient {
  calls: CallRecord[];
  client: ApiClient;
  nextDelete: unknown;
  nextGet: unknown;
  nextPatch: unknown;
  nextPost: unknown;
  nextPut: unknown;
  nextRequestJson: unknown;
  nextRequestResponse: Response;
  nextRequestText: string;
}

function createMockApiClient(): MockApiClient {
  const mock: MockApiClient = {
    calls: [],
    client: {
      delete: async <TResponse>(path: string, options?: Omit<RequestOptions, "body">) => {
        mock.calls.push({ method: "DELETE", options, path });
        return mock.nextDelete as TResponse;
      },
      get: async <TResponse>(path: string, options?: Omit<RequestOptions, "body">) => {
        mock.calls.push({ method: "GET", options, path });
        return mock.nextGet as TResponse;
      },
      patch: async <TResponse, TBody = unknown>(
        path: string,
        options?: Omit<RequestOptions, "body"> & { body?: TBody },
      ) => {
        mock.calls.push({ method: "PATCH", options, path });
        return mock.nextPatch as TResponse;
      },
      post: async <TResponse, TBody = unknown>(
        path: string,
        options?: Omit<RequestOptions, "body"> & { body?: TBody },
      ) => {
        mock.calls.push({ method: "POST", options, path });
        return mock.nextPost as TResponse;
      },
      put: async <TResponse, TBody = unknown>(
        path: string,
        options?: Omit<RequestOptions, "body"> & { body?: TBody },
      ) => {
        mock.calls.push({ method: "PUT", options, path });
        return mock.nextPut as TResponse;
      },
      requestJson: async <TResponse>(
        method: HttpMethod,
        path: string,
        options?: RequestOptions,
      ) => {
        mock.calls.push({ method, options, path });
        return mock.nextRequestJson as TResponse;
      },
      requestResponse: async (method: HttpMethod, path: string, options?: RequestOptions) => {
        mock.calls.push({ method, options, path });
        return mock.nextRequestResponse;
      },
      requestText: async (method: HttpMethod, path: string, options?: RequestOptions) => {
        mock.calls.push({ method, options, path });
        return mock.nextRequestText;
      },
    },
    nextDelete: undefined,
    nextGet: undefined,
    nextPatch: undefined,
    nextPost: undefined,
    nextPut: undefined,
    nextRequestJson: undefined,
    nextRequestResponse: new Response(null, { status: 200 }),
    nextRequestText: "",
  };

  return mock;
}

describe("path api wrappers", () => {
  it("listPersons forwards GET path and query filters", async () => {
    const mock = createMockApiClient();
    const filters: PersonFilterParams = {
      channelId: [10, 11],
      keyword: "alpha",
      pageNumber: 2,
      pageSize: 20,
    };
    const expected: PersonPageRes = {
      content: [],
      pageNumber: 2,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
    };
    mock.nextGet = expected;

    const actual = await listPersons(mock.client, filters);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "GET",
        options: { params: filters },
        path: "/path/person",
      },
    ]);
  });

  it("getPerson forwards GET path with numeric id", async () => {
    const mock = createMockApiClient();
    const expected = { id: 7 } as PersonDetailRes;
    mock.nextGet = expected;

    const actual = await getPerson(mock.client, 7);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([{ method: "GET", options: undefined, path: "/path/person/7" }]);
  });

  it("updatePerson forwards PATCH path and body", async () => {
    const mock = createMockApiClient();
    const payload: UpdatePersonReq = { firstName: "Ada", lastName: "Lovelace" };
    const expected = { id: 3 } as PersonDetailRes;
    mock.nextPatch = expected;

    const actual = await updatePerson(mock.client, 3, payload);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "PATCH",
        options: { body: payload },
        path: "/path/person/3",
      },
    ]);
  });

  it("deletePerson forwards DELETE path and returns void", async () => {
    const mock = createMockApiClient();
    mock.nextDelete = undefined;

    const actual = await deletePerson(mock.client, 9);

    expect(actual).toBeUndefined();
    expect(mock.calls).toEqual([{ method: "DELETE", options: undefined, path: "/path/person/9" }]);
  });

  it("mergePersons forwards POST merge path", async () => {
    const mock = createMockApiClient();
    const expected = { id: 12 } as PersonDetailRes;
    mock.nextPost = expected;

    const actual = await mergePersons(mock.client, 12, 99);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "POST",
        options: undefined,
        path: "/path/person/12/merge/99",
      },
    ]);
  });

  it("exportPersons uses requestText and returns text payload", async () => {
    const mock = createMockApiClient();
    const filters: PersonFilterParams = { keyword: "csv" };
    mock.nextRequestText = "id,name\n1,Alice\n";

    const actual = await exportPersons(mock.client, filters);

    expect(actual).toBe("id,name\n1,Alice\n");
    expect(mock.calls).toEqual([
      {
        method: "GET",
        options: { params: filters },
        path: "/path/person/export",
      },
    ]);
  });

  it("getPersonActivity forwards GET activity path and params", async () => {
    const mock = createMockApiClient();
    const params: PersonActivityParams = { cursor: 100, pageSize: 30 };
    const expected: PersonActivityRes = { content: [], hasNext: false, nextCursor: null };
    mock.nextGet = expected;

    const actual = await getPersonActivity(mock.client, 5, params);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "GET",
        options: { params },
        path: "/path/person/5/activity",
      },
    ]);
  });

  it("listChannels forwards GET path", async () => {
    const mock = createMockApiClient();
    const expected: ChannelRes[] = [];
    mock.nextGet = expected;

    const actual = await listChannels(mock.client);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([{ method: "GET", options: undefined, path: "/path/channel" }]);
  });

  it("getChannel forwards GET path", async () => {
    const mock = createMockApiClient();
    const expected = { id: 13 } as ChannelRes;
    mock.nextGet = expected;

    const actual = await getChannel(mock.client, 13);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([{ method: "GET", options: undefined, path: "/path/channel/13" }]);
  });

  it("createChannel forwards POST path and body", async () => {
    const mock = createMockApiClient();
    const payload: CreateChannelReq = { color: "#111111", name: "Partners" };
    const expected = { id: 8 } as ChannelRes;
    mock.nextPost = expected;

    const actual = await createChannel(mock.client, payload);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "POST",
        options: { body: payload },
        path: "/path/channel",
      },
    ]);
  });

  it("updateChannel forwards PUT path and body", async () => {
    const mock = createMockApiClient();
    const payload: UpdateChannelReq = { name: "New Name" };
    const expected = { id: 4 } as ChannelRes;
    mock.nextPut = expected;

    const actual = await updateChannel(mock.client, 4, payload);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "PUT",
        options: { body: payload },
        path: "/path/channel/4",
      },
    ]);
  });

  it("deleteChannel forwards DELETE path and returns void", async () => {
    const mock = createMockApiClient();
    mock.nextDelete = undefined;

    const actual = await deleteChannel(mock.client, 2);

    expect(actual).toBeUndefined();
    expect(mock.calls).toEqual([{ method: "DELETE", options: undefined, path: "/path/channel/2" }]);
  });

  it("listChannelPeople forwards GET path and filters", async () => {
    const mock = createMockApiClient();
    const filters: PersonFilterParams = { pageNumber: 1, pageSize: 10, keyword: "beta" };
    const expected = {
      content: [],
      pageNumber: 1,
      pageSize: 10,
      totalElements: 0,
      totalPages: 0,
    } as PersonPageRes;
    mock.nextGet = expected;

    const actual = await listChannelPeople(mock.client, 21, filters);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "GET",
        options: { params: filters },
        path: "/path/channel/21/person",
      },
    ]);
  });

  it("addPersonToChannel forwards POST path and body", async () => {
    const mock = createMockApiClient();
    const payload: CreatePersonReq = { email: "a@example.com", firstName: "A" };
    const expected = { id: 88 } as PersonDetailRes;
    mock.nextPost = expected;

    const actual = await addPersonToChannel(mock.client, 12, payload);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "POST",
        options: { body: payload },
        path: "/path/channel/12/person",
      },
    ]);
  });

  it("exportChannelPeople uses requestText and returns text payload", async () => {
    const mock = createMockApiClient();
    mock.nextRequestText = "id,name\n4,Bob\n";

    const actual = await exportChannelPeople(mock.client, 6);

    expect(actual).toBe("id,name\n4,Bob\n");
    expect(mock.calls).toEqual([
      {
        method: "GET",
        options: undefined,
        path: "/path/channel/6/person/export",
      },
    ]);
  });

  it("getOverview forwards GET path", async () => {
    const mock = createMockApiClient();
    const expected: PathOverviewRes = {
      channelCount: 3,
      eventCount: 4,
      peopleCount: 5,
    };
    mock.nextGet = expected;

    const actual = await getOverview(mock.client);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([{ method: "GET", options: undefined, path: "/path/overview" }]);
  });

  it("getOverviewStats omits timeZone query when not provided", async () => {
    const mock = createMockApiClient();
    const expected = {
      latestTrend: [],
      newPeopleThisMonth: 1,
      topChannels: [],
      totalChannels: 2,
      totalCompanies: 3,
      totalEvents: 4,
      totalPeople: 5,
    } as PathOverviewStatsRes;
    mock.nextGet = expected;

    const actual = await getOverviewStats(mock.client);

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "GET",
        options: undefined,
        path: "/path/overview/stats",
      },
    ]);
  });

  it("getOverviewStats forwards timeZone query when provided", async () => {
    const mock = createMockApiClient();
    const expected = {
      latestTrend: [],
      newPeopleThisMonth: 1,
      topChannels: [],
      totalChannels: 2,
      totalCompanies: 3,
      totalEvents: 4,
      totalPeople: 5,
    } as PathOverviewStatsRes;
    mock.nextGet = expected;

    const actual = await getOverviewStats(mock.client, "Asia/Seoul");

    expect(actual).toBe(expected);
    expect(mock.calls).toEqual([
      {
        method: "GET",
        options: { params: { timeZone: "Asia/Seoul" } },
        path: "/path/overview/stats",
      },
    ]);
  });
});
