import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../../src/errors/index.js", () => ({
  CliError: class CliError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CliError";
    }
  },
  isProblemDetail: () => false,
  parseProblemDetail: vi.fn(),
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
});
