import { CliError, isProblemDetail, parseProblemDetail } from "../errors/index.js";
import { DEFAULT_TIMEOUT_MS, USER_AGENT } from "./constants.js";
import { client as authClient } from "./generated/auth/client.gen.js";
import { client as pathClient } from "./generated/path/client.gen.js";
import { withRetry } from "./retry.js";

let interceptorsRegistered = false;
let refreshFn: (() => Promise<boolean>) | undefined;
let authFn: (() => Promise<string | undefined>) | undefined;
let refreshPromise: Promise<boolean> | undefined;

export function configureClients(options: {
  baseUrl: string;
  auth: () => Promise<string | undefined>;
  onRefreshToken?: () => Promise<boolean>;
}): void {
  authFn = options.auth;
  refreshFn = options.onRefreshToken;
  refreshPromise = undefined;

  for (const client of [authClient, pathClient]) {
    client.setConfig({
      baseUrl: options.baseUrl,
      auth: options.auth,
    });
  }

  if (interceptorsRegistered) return;
  interceptorsRegistered = true;

  for (const client of [authClient, pathClient]) {
    client.interceptors.request.use((request: Request) => {
      request.headers.set("User-Agent", USER_AGENT);
      return request;
    });

    client.interceptors.response.use(async (response: Response, request: Request) => {
      if (response.status === 401 && refreshFn) {
        if (!refreshPromise) {
          refreshPromise = refreshFn().finally(() => {
            refreshPromise = undefined;
          });
        }
        const refreshed = await refreshPromise;
        if (refreshed && authFn) {
          const newToken = await authFn();
          if (newToken) {
            const retryRequest = new Request(request, {
              headers: new Headers(request.headers),
            });
            retryRequest.headers.set("Authorization", `Bearer ${newToken}`);
            // Body stream is consumed after first fetch — retry safe for GET only
            return withRetry(() =>
              fetch(retryRequest, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) }),
            );
          }
        }
      }

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          try {
            const body = await response.clone().json();
            if (isProblemDetail(body)) {
              throw parseProblemDetail(body);
            }
          } catch (error) {
            if (error instanceof CliError) throw error;
            // Non-ProblemDetail body — fall through to generic error
          }
        }
        throw new CliError(`Request failed with status ${response.status}`);
      }
      return response;
    });
  }
}
