import { createStoredTokenRefreshHandler } from "../auth/refresh.js";
import { getAccessToken, getRefreshToken } from "../auth/token.js";
import { getActiveProfile, loadConfig } from "../config/config.js";
import type { Config } from "../config/config.js";
import { resolveEnv } from "../config/env.js";
import type { EnvConfig } from "../config/env.js";
import { CliError, isProblemDetail, parseProblemDetail } from "../errors/index.js";

type QueryPrimitive = boolean | number | string;

export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;

export type QueryParams = Record<string, QueryValue>;

export type TokenGetter = () => Promise<string | undefined> | string | undefined;
export type RefreshCallback = () => Promise<boolean> | boolean;
export type RequestHeaders = Record<string, string>;

export interface RequestOptions {
  body?: unknown;
  headers?: RequestHeaders;
  params?: QueryParams;
  signal?: AbortSignal;
}

export interface ApiClientFactoryOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  getAccessToken?: TokenGetter;
  getRefreshToken?: TokenGetter;
  onRefreshToken?: RefreshCallback;
}

export interface RuntimeApiClientOptions {
  baseUrl: string;
  clientId: string;
  config: Config;
  env: EnvConfig;
  profile: string;
}

export interface ApiClient {
  requestJson<TResponse>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions,
  ): Promise<TResponse>;
  requestResponse(method: HttpMethod, path: string, options?: RequestOptions): Promise<Response>;
  requestText(method: HttpMethod, path: string, options?: RequestOptions): Promise<string>;
  get<TResponse>(path: string, options?: Omit<RequestOptions, "body">): Promise<TResponse>;
  post<TResponse, TBody = unknown>(
    path: string,
    options?: Omit<RequestOptions, "body"> & { body?: TBody },
  ): Promise<TResponse>;
  put<TResponse, TBody = unknown>(
    path: string,
    options?: Omit<RequestOptions, "body"> & { body?: TBody },
  ): Promise<TResponse>;
  patch<TResponse, TBody = unknown>(
    path: string,
    options?: Omit<RequestOptions, "body"> & { body?: TBody },
  ): Promise<TResponse>;
  delete<TResponse>(path: string, options?: Omit<RequestOptions, "body">): Promise<TResponse>;
}

const JSON_CONTENT_TYPE = "application/json";

const HTTP_METHODS = ["DELETE", "GET", "PATCH", "POST", "PUT"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "unknown network error";
}

function appendQueryParam(url: URL, key: string, value: QueryPrimitive): void {
  url.searchParams.append(key, String(value));
}

function buildUrl(baseUrl: string, path: string, params: QueryParams | undefined): string {
  const url = new URL(path, `${normalizeBaseUrl(baseUrl)}/`);

  if (!params) {
    return url.toString();
  }

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        appendQueryParam(url, key, item);
      }

      continue;
    }

    appendQueryParam(url, key, rawValue);
  }

  return url.toString();
}

function hasBody(body: unknown): boolean {
  return body !== undefined;
}

async function parseErrorResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes(JSON_CONTENT_TYPE)) {
    return undefined;
  }

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function throwHttpError(response: Response): Promise<never> {
  const responseBody = await parseErrorResponseBody(response);

  if (isProblemDetail(responseBody)) {
    throw parseProblemDetail(responseBody);
  }

  throw new CliError(`Request failed with status ${response.status}`);
}

export function createApiClient(options: ApiClientFactoryOptions): ApiClient {
  const fetchFn = options.fetchFn ?? fetch;

  const sendRequest = async (
    method: HttpMethod,
    path: string,
    requestOptions?: RequestOptions,
    didRetryAfterRefresh = false,
  ): Promise<Response> => {
    const url = buildUrl(options.baseUrl, path, requestOptions?.params);
    const headers = new Headers(requestOptions?.headers);
    const accessToken = await options.getAccessToken?.();

    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }

    const init: RequestInit = {
      headers,
      method,
      signal: requestOptions?.signal,
    };

    const body = requestOptions?.body;

    if (hasBody(body)) {
      headers.set("content-type", JSON_CONTENT_TYPE);
      init.body = JSON.stringify(body);
    }

    let response: Response;

    try {
      response = await fetchFn(url, init);
    } catch (error) {
      throw new CliError(
        `Network error connecting to ${url} — ${toErrorMessage(error)}. Check your API URL with 'talkvalue config get api_url'`,
      );
    }

    if (response.status === 401 && !didRetryAfterRefresh) {
      const refreshToken = await options.getRefreshToken?.();

      if (refreshToken && options.onRefreshToken) {
        const refreshed = await options.onRefreshToken();

        if (refreshed) {
          return sendRequest(method, path, requestOptions, true);
        }
      }
    }

    if (!response.ok) {
      await throwHttpError(response);
    }

    return response;
  };

  const requestResponse = async (
    method: HttpMethod,
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<Response> => {
    return sendRequest(method, path, requestOptions);
  };

  const requestJson = async <TResponse>(
    method: HttpMethod,
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<TResponse> => {
    const response = await requestResponse(method, path, requestOptions);

    if (response.status === 204) {
      return undefined as TResponse;
    }

    const contentType = response.headers.get("content-type");

    if (contentType?.includes(JSON_CONTENT_TYPE)) {
      return (await response.json()) as TResponse;
    }

    const payload = await response.text();

    if (payload.length === 0) {
      return undefined as TResponse;
    }

    throw new CliError(
      `Expected JSON response but received ${contentType ?? "unknown content-type"}`,
    );
  };

  const requestText = async (
    method: HttpMethod,
    path: string,
    requestOptions?: RequestOptions,
  ): Promise<string> => {
    const response = await requestResponse(method, path, requestOptions);
    return response.text();
  };

  const get = async <TResponse>(
    path: string,
    requestOptions?: Omit<RequestOptions, "body">,
  ): Promise<TResponse> => {
    return requestJson<TResponse>("GET", path, requestOptions);
  };

  const post = async <TResponse, TBody = unknown>(
    path: string,
    requestOptions?: Omit<RequestOptions, "body"> & { body?: TBody },
  ): Promise<TResponse> => {
    return requestJson<TResponse>("POST", path, requestOptions);
  };

  const put = async <TResponse, TBody = unknown>(
    path: string,
    requestOptions?: Omit<RequestOptions, "body"> & { body?: TBody },
  ): Promise<TResponse> => {
    return requestJson<TResponse>("PUT", path, requestOptions);
  };

  const patch = async <TResponse, TBody = unknown>(
    path: string,
    requestOptions?: Omit<RequestOptions, "body"> & { body?: TBody },
  ): Promise<TResponse> => {
    return requestJson<TResponse>("PATCH", path, requestOptions);
  };

  const deleteRequest = async <TResponse>(
    path: string,
    requestOptions?: Omit<RequestOptions, "body">,
  ): Promise<TResponse> => {
    return requestJson<TResponse>("DELETE", path, requestOptions);
  };

  return {
    delete: deleteRequest,
    get,
    patch,
    post,
    put,
    requestJson,
    requestResponse,
    requestText,
  };
}

export async function createDefaultApiClient(): Promise<ApiClient> {
  const config = await loadConfig();
  const env = resolveEnv();
  const profile = env.profile ?? (await getActiveProfile());
  const baseUrl = env.apiUrl ?? config.api_url;

  return createRuntimeApiClient({
    baseUrl,
    clientId: config.client_id,
    config,
    env,
    profile,
  });
}

export function createRuntimeApiClient(options: RuntimeApiClientOptions): ApiClient {
  if (!options.profile) {
    return createApiClient({
      baseUrl: options.baseUrl,
      getAccessToken: async () => options.env.token,
    });
  }

  return createApiClient({
    baseUrl: options.baseUrl,
    getAccessToken: async () => options.env.token ?? getAccessToken(options.profile),
    getRefreshToken: async () => getRefreshToken(options.profile),
    onRefreshToken: createStoredTokenRefreshHandler({
      authApiUrl: options.env.authApiUrl,
      clientId: options.clientId,
      env: options.env,
      organizationId: options.config.profiles[options.profile]?.org_id,
      profile: options.profile,
    }),
  });
}

export function isHttpMethod(method: string): method is HttpMethod {
  return HTTP_METHODS.includes(method as HttpMethod);
}
