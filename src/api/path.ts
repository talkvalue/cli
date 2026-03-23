import type { ApiClient, QueryParams } from "./client.js";
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
} from "./generated/index.js";

export async function listPersons(
  client: ApiClient,
  filters?: PersonFilterParams,
): Promise<PersonPageRes> {
  return client.get<PersonPageRes>("/path/person", {
    params: toQueryParams(filters),
  });
}

export async function getPerson(client: ApiClient, id: number): Promise<PersonDetailRes> {
  return client.get<PersonDetailRes>(`/path/person/${id}`);
}

export async function updatePerson(
  client: ApiClient,
  id: number,
  data: UpdatePersonReq,
): Promise<PersonDetailRes> {
  return client.patch<PersonDetailRes, UpdatePersonReq>(`/path/person/${id}`, {
    body: data,
  });
}

export async function deletePerson(client: ApiClient, id: number): Promise<void> {
  return client.delete<void>(`/path/person/${id}`);
}

export async function mergePersons(
  client: ApiClient,
  sourceId: number,
  targetId: number,
): Promise<PersonDetailRes> {
  return client.post<PersonDetailRes>(`/path/person/${sourceId}/merge/${targetId}`);
}

export async function exportPersons(
  client: ApiClient,
  filters?: PersonFilterParams,
): Promise<string> {
  return client.requestText("GET", "/path/person/export", {
    params: toQueryParams(filters),
  });
}

export async function getPersonActivity(
  client: ApiClient,
  id: number,
  params?: PersonActivityParams,
): Promise<PersonActivityRes> {
  return client.get<PersonActivityRes>(`/path/person/${id}/activity`, {
    params: toQueryParams(params),
  });
}

export async function listChannels(client: ApiClient): Promise<ChannelRes[]> {
  return client.get<ChannelRes[]>("/path/channel");
}

export async function getChannel(client: ApiClient, id: number): Promise<ChannelRes> {
  return client.get<ChannelRes>(`/path/channel/${id}`);
}

export async function createChannel(
  client: ApiClient,
  data: CreateChannelReq,
): Promise<ChannelRes> {
  return client.post<ChannelRes, CreateChannelReq>("/path/channel", {
    body: data,
  });
}

export async function updateChannel(
  client: ApiClient,
  id: number,
  data: UpdateChannelReq,
): Promise<ChannelRes> {
  return client.put<ChannelRes, UpdateChannelReq>(`/path/channel/${id}`, {
    body: data,
  });
}

export async function deleteChannel(client: ApiClient, id: number): Promise<void> {
  return client.delete<void>(`/path/channel/${id}`);
}

export async function listChannelPeople(
  client: ApiClient,
  channelId: number,
  filters?: PersonFilterParams,
): Promise<PersonPageRes> {
  return client.get<PersonPageRes>(`/path/channel/${channelId}/person`, {
    params: toQueryParams(filters),
  });
}

export async function addPersonToChannel(
  client: ApiClient,
  channelId: number,
  data: CreatePersonReq,
): Promise<PersonDetailRes> {
  return client.post<PersonDetailRes, CreatePersonReq>(`/path/channel/${channelId}/person`, {
    body: data,
  });
}

export async function exportChannelPeople(client: ApiClient, channelId: number): Promise<string> {
  return client.requestText("GET", `/path/channel/${channelId}/person/export`);
}

export async function getOverview(client: ApiClient): Promise<PathOverviewRes> {
  return client.get<PathOverviewRes>("/path/overview");
}

export async function getOverviewStats(
  client: ApiClient,
  timeZone?: string,
): Promise<PathOverviewStatsRes> {
  if (timeZone === undefined) {
    return client.get<PathOverviewStatsRes>("/path/overview/stats");
  }

  return client.get<PathOverviewStatsRes>("/path/overview/stats", {
    params: { timeZone },
  });
}

function toQueryParams(
  params: PersonActivityParams | PersonFilterParams | undefined,
): QueryParams | undefined {
  if (params === undefined) {
    return undefined;
  }

  const queryParams: QueryParams = {};

  for (const [key, value] of Object.entries(params)) {
    queryParams[key] = value;
  }

  return queryParams;
}
