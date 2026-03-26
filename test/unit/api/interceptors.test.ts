import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { CliError, ForbiddenError, NotFoundError } from "../../../src/errors/index.js";

let responseInterceptor: (response: Response, request: Request) => Promise<Response>;

vi.mock("../../../src/api/generated/auth/client.gen.js", () => ({
  client: {
    setConfig: vi.fn(),
    interceptors: {
      request: { use: () => {} },
      response: {
        use: (fn: (response: Response, request: Request) => Promise<Response>) => {
          responseInterceptor = fn;
        },
      },
    },
  },
}));

vi.mock("../../../src/api/generated/path/client.gen.js", () => ({
  client: {
    setConfig: vi.fn(),
    interceptors: {
      request: { use: () => {} },
      response: {
        use: () => {},
      },
    },
  },
}));

import { configureClients } from "../../../src/api/interceptors.js";

function make401(): Response {
  return new Response(null, { status: 401 });
}

function makeRequest(): Request {
  return new Request("https://api.example.com/test");
}

function makeOkResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

describe("interceptors token refresh concurrency", () => {
  let refreshFn: Mock<() => Promise<boolean>>;
  let authFn: Mock<() => Promise<string | undefined>>;

  beforeEach(() => {
    refreshFn = vi.fn();
    authFn = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(makeOkResponse());

    configureClients({
      baseUrl: "https://api.example.com",
      auth: authFn,
      onRefreshToken: refreshFn,
    });
  });

  it("single 401 triggers one refresh", async () => {
    refreshFn.mockResolvedValueOnce(true);
    authFn.mockResolvedValueOnce("new-token");
    const retryResponse = makeOkResponse();
    vi.mocked(fetch).mockResolvedValueOnce(retryResponse);

    const result = await responseInterceptor(make401(), makeRequest());

    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(authFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(retryResponse);
  });

  it("concurrent 401s trigger only ONE refresh", async () => {
    let resolveRefresh!: (value: boolean) => void;
    refreshFn.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    authFn.mockResolvedValue("new-token");
    const retryResponse = makeOkResponse();
    vi.mocked(fetch).mockResolvedValue(retryResponse);

    const p1 = responseInterceptor(make401(), makeRequest());
    const p2 = responseInterceptor(make401(), makeRequest());

    expect(refreshFn).toHaveBeenCalledTimes(1);

    resolveRefresh(true);
    await Promise.all([p1, p2]);

    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("failed refresh propagates to all waiters", async () => {
    let resolveRefresh!: (value: boolean) => void;
    refreshFn.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const p1 = responseInterceptor(make401(), makeRequest());
    const p2 = responseInterceptor(make401(), makeRequest());

    resolveRefresh(false);

    await expect(p1).rejects.toThrow("Request failed with status 401");
    await expect(p2).rejects.toThrow("Request failed with status 401");
  });

  it("writes warning to stderr when refresh throws and returns original response", async () => {
    const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    refreshFn.mockRejectedValueOnce(new Error("refresh failed"));

    try {
      const result = await responseInterceptor(make401(), makeRequest());

      expect(result.status).toBe(401);
      expect(stderrWrite).toHaveBeenCalledWith(
        "Warning: token refresh failed, returning original 401 response\n",
      );
    } finally {
      stderrWrite.mockRestore();
    }
  });

  it("successful refresh shared across waiters", async () => {
    let resolveRefresh!: (value: boolean) => void;
    refreshFn.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    authFn.mockResolvedValue("shared-token");
    const retryResponse = makeOkResponse();
    vi.mocked(fetch).mockResolvedValue(retryResponse);

    const p1 = responseInterceptor(make401(), makeRequest());
    const p2 = responseInterceptor(make401(), makeRequest());

    resolveRefresh(true);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(authFn).toHaveBeenCalledTimes(2);
  });

  it("throws ForbiddenError for 403 ProblemDetail response", async () => {
    const response = new Response(
      JSON.stringify({
        detail: "Forbidden resource",
        status: 403,
        title: "Forbidden",
        type: "https://example.com/problems/forbidden",
      }),
      {
        headers: { "content-type": "application/json" },
        status: 403,
      },
    );

    await expect(responseInterceptor(response, makeRequest())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(responseInterceptor(response, makeRequest())).rejects.toThrow(
      "Forbidden resource",
    );
  });

  it("throws generic CliError for 429 with Retry-After header", async () => {
    const response = new Response(JSON.stringify({ message: "Too many requests" }), {
      headers: {
        "content-type": "application/json",
        "retry-after": "120",
      },
      status: 429,
    });

    await expect(responseInterceptor(response, makeRequest())).rejects.toBeInstanceOf(CliError);
    await expect(responseInterceptor(response, makeRequest())).rejects.toThrow(
      "Request failed with status 429",
    );
  });

  it("throws generic CliError for 500 response", async () => {
    const response = new Response("Internal server error", {
      headers: { "content-type": "text/plain" },
      status: 500,
    });

    await expect(responseInterceptor(response, makeRequest())).rejects.toBeInstanceOf(CliError);
    await expect(responseInterceptor(response, makeRequest())).rejects.toThrow(
      "Request failed with status 500",
    );
  });

  it("throws generic CliError for non-JSON error body", async () => {
    const response = new Response("<html>bad gateway</html>", {
      headers: { "content-type": "text/html" },
      status: 502,
    });

    await expect(responseInterceptor(response, makeRequest())).rejects.toBeInstanceOf(CliError);
    await expect(responseInterceptor(response, makeRequest())).rejects.toThrow(
      "Request failed with status 502",
    );
  });

  it("parses ProblemDetail with application/problem+json content type", async () => {
    const response = new Response(
      JSON.stringify({
        detail: "Resource not found",
        status: 404,
        title: "Not Found",
        type: "https://example.com/problems/not-found",
      }),
      {
        headers: { "content-type": "application/problem+json" },
        status: 404,
      },
    );

    await expect(responseInterceptor(response, makeRequest())).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(responseInterceptor(response, makeRequest())).rejects.toThrow(
      "Resource not found",
    );
  });

  it("uses detail field as error message for partial ProblemDetail", async () => {
    const response = new Response(
      JSON.stringify({
        detail: "error.import_file_invalid_format",
        instance: "/path/import/analyze",
        status: 400,
        title: "Bad Request",
        errorCode: -1,
      }),
      {
        headers: { "content-type": "application/problem+json" },
        status: 400,
      },
    );

    await expect(responseInterceptor(response, makeRequest())).rejects.toBeInstanceOf(CliError);
    await expect(responseInterceptor(response, makeRequest())).rejects.toThrow(
      "error.import_file_invalid_format",
    );
  });

  it("parses ProblemDetail JSON into typed errors", async () => {
    const response = new Response(
      JSON.stringify({
        detail: "Path missing",
        status: 404,
        title: "Not Found",
        type: "https://example.com/problems/not-found",
      }),
      {
        headers: { "content-type": "application/json" },
        status: 404,
      },
    );

    await expect(responseInterceptor(response, makeRequest())).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(responseInterceptor(response, makeRequest())).rejects.toThrow("Path missing");
  });
});
