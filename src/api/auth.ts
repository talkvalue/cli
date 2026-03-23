import type { ApiClient } from "./client.js";
import type { AuthOverviewRes, OrganizationListRes, OrganizationRes } from "./generated/index.js";

export async function getAuthOverview(client: ApiClient): Promise<AuthOverviewRes> {
  return client.get<AuthOverviewRes>("/auth/overview");
}

export async function getOrganizations(client: ApiClient): Promise<OrganizationRes[]> {
  const response = await client.get<OrganizationListRes>("/auth/organization");
  return response.data;
}
