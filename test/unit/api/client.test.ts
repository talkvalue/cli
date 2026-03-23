import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../../../src/api/client.js";
import { AuthError, CliError, NotFoundError } from "../../../src/errors/index.js";

interface RequestLog {
  input: RequestInfo | URL;
  init?: RequestInit;
}

function createJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

describe("createApiClient", () => {
  it("builds query strings with repeated array params for GET", async () => {
    const requests: RequestLog[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ init, input });
      return createJsonResponse(200, { ok: true });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
    });

    await client.get<{ ok: boolean }>("/people", {
      params: {
        channelId: [10, 11],
        keyword: "alpha",
        pageNumber: 2,
        pageSize: 20,
        sort: ["createdAt,desc", "name,asc"],
      },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.input).toBe(
      "https://api.example.com/people?channelId=10&channelId=11&keyword=alpha&pageNumber=2&pageSize=20&sort=createdAt%2Cdesc&sort=name%2Casc",
    );
    expect(requests[0]?.init?.method).toBe("GET");
  });

  it("injects bearer authorization header when access token exists", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return createJsonResponse(200, {
        auth: init?.headers ? new Headers(init.headers).get("authorization") : null,
      });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
      getAccessToken: async () => "token-abc",
    });

    const result = await client.get<{ auth: string | null }>("/me");

    expect(result.auth).toBe("Bearer token-abc");
  });

  it("sets json content-type and serializes body for json requests", async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      return createJsonResponse(200, {
        body: init?.body,
        contentType: headers.get("content-type"),
      });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
    });

    const result = await client.post<
      { body: string | null; contentType: string | null },
      { name: string }
    >("/channels", {
      body: { name: "partners" },
    });

    expect(result.contentType).toBe("application/json");
    expect(result.body).toBe('{"name":"partners"}');
  });

  it("parses RFC7807 error responses through parseProblemDetail", async () => {
    const fetchFn = vi.fn(async () => {
      return createJsonResponse(404, {
        detail: "Person not found",
        status: 404,
        title: "Not Found",
        type: "https://example.com/problems/not-found",
      });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
    });

    await expect(client.get("/people/404")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("converts network failures to CliError with clear message", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
    });

    await expect(client.get("/people")).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining("Network error connecting to"),
      }),
    );
    await expect(client.get("/people")).rejects.toBeInstanceOf(CliError);
  });

  it("returns text response for CSV/text endpoints", async () => {
    const fetchFn = vi.fn(async () => {
      return new Response("id,name\n1,Alice\n", {
        headers: {
          "content-type": "text/csv",
        },
        status: 200,
      });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
    });

    const csv = await client.requestText("GET", "/people/export");

    expect(csv).toBe("id,name\n1,Alice\n");
  });

  it("returns raw response for streaming endpoints", async () => {
    const fetchFn = vi.fn(async () => {
      return new Response("chunk-data", {
        headers: {
          "content-type": "text/plain",
        },
        status: 200,
      });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
    });

    const response = await client.requestResponse("GET", "/stream");

    expect(response.ok).toBe(true);
    expect(await response.text()).toBe("chunk-data");
  });

  it("attempts a single refresh on 401 and retries once", async () => {
    let token = "old-token";
    const refresh = vi.fn(async () => {
      token = "new-token";
      return true;
    });
    const authHeaders: Array<string | null> = [];

    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      authHeaders.push(new Headers(init?.headers).get("authorization"));

      if (authHeaders.length === 1) {
        return createJsonResponse(401, {
          detail: "Token expired",
          status: 401,
          title: "Unauthorized",
          type: "https://example.com/problems/auth",
        });
      }

      return createJsonResponse(200, { ok: true });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
      getAccessToken: async () => token,
      getRefreshToken: async () => "refresh-token",
      onRefreshToken: refresh,
    });

    const result = await client.get<{ ok: boolean }>("/protected");

    expect(result.ok).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(authHeaders).toEqual(["Bearer old-token", "Bearer new-token"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not refresh repeatedly when retry still returns 401", async () => {
    const refresh = vi.fn(async () => true);
    const fetchFn = vi.fn(async () => {
      return createJsonResponse(401, {
        detail: "Still unauthorized",
        status: 401,
        title: "Unauthorized",
        type: "https://example.com/problems/auth",
      });
    });

    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchFn,
      getAccessToken: async () => "token",
      getRefreshToken: async () => "refresh-token",
      onRefreshToken: refresh,
    });

    await expect(client.get("/protected")).rejects.toBeInstanceOf(AuthError);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
