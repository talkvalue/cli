import type { AuthOverviewRes, OrganizationListRes, OrganizationRes } from "./auth/types.gen.js";
import type {
  ChannelRes,
  CreateChannelReq,
  CreatePersonReq,
  GetActivityData,
  ListPeopleData,
  PathOverviewRes,
  PathOverviewStatsRes,
  PersonActivityRes,
  PersonDetailRes,
  PersonPageRes,
  UpdateChannelReq,
  UpdatePersonReq,
} from "./path/types.gen.js";

export type {
  AuthOverviewRes,
  OrganizationListRes,
  OrganizationRes,
  ChannelRes,
  CreateChannelReq,
  CreatePersonReq,
  PathOverviewRes,
  PathOverviewStatsRes,
  PersonActivityRes,
  PersonDetailRes,
  PersonPageRes,
  UpdateChannelReq,
  UpdatePersonReq,
};

export type PersonActivityParams = NonNullable<GetActivityData["query"]>;
export type PersonFilterParams = NonNullable<ListPeopleData["query"]>;
