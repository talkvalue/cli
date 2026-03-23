import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authenticateWithRefreshToken,
  openVerificationUri,
  pollForToken,
  requestDeviceCode,
} from "../../../src/auth/device-flow.js";
import { AuthError } from "../../../src/errors/index.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockChildProcess = (): ChildProcess => {
  return {
    unref: vi.fn(),
  } as unknown as ChildProcess;
};

describe("requestDeviceCode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts form-encoded device authorization request", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          device_code: "device_123",
          user_code: "ABCD-EFGH",
          verification_uri: "https://auth.example.com/activate",
          verification_uri_complete: "https://auth.example.com/activate?user_code=ABCD-EFGH",
          expires_in: 900,
          interval: 5,
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );

    const response = await requestDeviceCode({
      clientId: "client_123",
      scopes: ["openid", "profile", "email"],
    });

    expect(response.device_code).toBe("device_123");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.workos.com/user_management/authorize/device");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(init?.body).toBeInstanceOf(URLSearchParams);

    if (!(init?.body instanceof URLSearchParams)) {
      throw new Error("Expected URLSearchParams request body");
    }

    expect(init.body.get("client_id")).toBe("client_123");
    expect(init.body.get("scope")).toBe("openid profile email");
  });

  it("throws AuthError when response is not ok", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "client is invalid",
        }),
        {
          headers: { "content-type": "application/json" },
          status: 401,
        },
      ),
    );

    await expect(
      requestDeviceCode({
        clientId: "client_123",
        scopes: ["openid"],
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});

describe("pollForToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries on authorization_pending and then returns token", async () => {
    const fetchMock = vi.mocked(fetch);
    const sleep = vi.fn(async (_ms: number) => Promise.resolve());

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "authorization_pending" }), {
          headers: { "content-type": "application/json" },
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access_123",
            expires_in: 3600,
            refresh_token: "refresh_123",
            scope: "openid profile email",
            token_type: "Bearer",
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        ),
      );

    const token = await pollForToken({
      clientId: "client_123",
      deviceCode: "device_123",
      intervalSeconds: 2,
      sleep,
    });

    expect(token.access_token).toBe("access_123");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.body).toBeInstanceOf(URLSearchParams);

    if (!(init?.body instanceof URLSearchParams)) {
      throw new Error("Expected URLSearchParams request body");
    }

    expect(init.body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
    expect(init.body.get("device_code")).toBe("device_123");
    expect(init.body.get("client_id")).toBe("client_123");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.workos.com/user_management/authenticate",
    );
  });

  it("accepts successful responses without token_type", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "access_123",
          refresh_token: "refresh_123",
          user: { email: "test@example.com" },
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );

    const token = await pollForToken({
      clientId: "client_123",
      deviceCode: "device_123",
      intervalSeconds: 2,
    });

    expect(token.access_token).toBe("access_123");
    expect(token.user?.email).toBe("test@example.com");
  });

  it("refreshes access token through user management authenticate", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "access_new",
          refresh_token: "refresh_new",
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      ),
    );

    const token = await authenticateWithRefreshToken({
      apiBaseUrl: "https://api.workos.com",
      clientId: "client_123",
      organizationId: "org_123",
      refreshToken: "refresh_old",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.workos.com/user_management/authenticate",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(token.access_token).toBe("access_new");
    expect(token.refresh_token).toBe("refresh_new");
  });

  it("adds five seconds to interval after slow_down", async () => {
    const fetchMock = vi.mocked(fetch);
    const sleep = vi.fn(async (_ms: number) => Promise.resolve());

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "slow_down" }), {
          headers: { "content-type": "application/json" },
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "authorization_pending" }), {
          headers: { "content-type": "application/json" },
          status: 400,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access_123",
            token_type: "Bearer",
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        ),
      );

    await pollForToken({
      clientId: "client_123",
      deviceCode: "device_123",
      intervalSeconds: 2,
      sleep,
    });

    expect(sleep).toHaveBeenNthCalledWith(1, 7000);
    expect(sleep).toHaveBeenNthCalledWith(2, 7000);
  });

  it("throws AuthError on expired_token", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "expired_token" }), {
        headers: { "content-type": "application/json" },
        status: 400,
      }),
    );

    await expect(
      pollForToken({
        clientId: "client_123",
        deviceCode: "device_123",
        intervalSeconds: 2,
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError on access_denied", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "access_denied",
          error_description: "user denied access",
        }),
        {
          headers: { "content-type": "application/json" },
          status: 400,
        },
      ),
    );

    await expect(
      pollForToken({
        clientId: "client_123",
        deviceCode: "device_123",
        intervalSeconds: 2,
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError on other terminal errors", async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "terminal",
        }),
        {
          headers: { "content-type": "application/json" },
          status: 400,
        },
      ),
    );

    await expect(
      pollForToken({
        clientId: "client_123",
        deviceCode: "device_123",
        intervalSeconds: 2,
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});

describe("openVerificationUri", () => {
  const spawnMock = vi.mocked(spawn);

  beforeEach(() => {
    process.env.TALKVALUE_DISABLE_BROWSER_OPEN = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not launch a browser when disabled by env", () => {
    process.env.TALKVALUE_DISABLE_BROWSER_OPEN = "1";

    const result = openVerificationUri("https://auth.example.com/activate");

    expect(result).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("uses open on macOS", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    spawnMock.mockReturnValueOnce(mockChildProcess());

    const result = openVerificationUri("https://auth.example.com/activate");

    expect(result).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith("open", ["https://auth.example.com/activate"], {
      detached: true,
      stdio: "ignore",
    });
  });

  it("uses xdg-open on linux", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
    spawnMock.mockReturnValueOnce(mockChildProcess());

    const result = openVerificationUri("https://auth.example.com/activate");

    expect(result).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith("xdg-open", ["https://auth.example.com/activate"], {
      detached: true,
      stdio: "ignore",
    });
  });

  it("uses start command on windows", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    spawnMock.mockReturnValueOnce(mockChildProcess());

    const result = openVerificationUri("https://auth.example.com/activate");

    expect(result).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith(
      "cmd",
      ["/c", "start", "", "https://auth.example.com/activate"],
      {
        detached: true,
        stdio: "ignore",
      },
    );
  });

  it("fails gracefully when browser launch throws", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    spawnMock.mockImplementationOnce(() => {
      throw new Error("spawn failed");
    });

    const result = openVerificationUri("https://auth.example.com/activate");

    expect(result).toBe(false);
  });
});
