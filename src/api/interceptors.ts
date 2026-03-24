import { CliError, isProblemDetail, parseProblemDetail } from "../errors/index.js";
import { client as authClient } from "./generated/auth/client.gen.js";
import { client as pathClient } from "./generated/path/client.gen.js";

let interceptorsRegistered = false;
let refreshFn: (() => Promise<boolean>) | undefined;
let authFn: (() => Promise<string | undefined>) | undefined;

export function configureClients(options: {
  baseUrl: string;
  auth: () => Promise<string | undefined>;
  onRefreshToken?: () => Promise<boolean>;
}): void {
  authFn = options.auth;
  refreshFn = options.onRefreshToken;

  for (const client of [authClient, pathClient]) {
    client.setConfig({
      baseUrl: options.baseUrl,
      auth: options.auth,
    });
  }

  if (interceptorsRegistered) return;
  interceptorsRegistered = true;

  for (const client of [authClient, pathClient]) {
    // Interceptor signature: (response, request, opts) => response
    client.interceptors.response.use(async (response: Response, request: Request) => {
      // 401 retry with token refresh
      if (response.status === 401 && refreshFn) {
        const refreshed = await refreshFn();
        if (refreshed && authFn) {
          const newToken = await authFn();
          if (newToken) {
            const retryRequest = new Request(request, {
              headers: new Headers(request.headers),
            });
            retryRequest.headers.set("Authorization", `Bearer ${newToken}`);
            return fetch(retryRequest);
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
            // JSON parse failure or non-ProblemDetail body — fall through to generic error
          }
        }
        throw new CliError(`Request failed with status ${response.status}`);
      }
      return response;
    });
  }
}
