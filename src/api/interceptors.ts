import { CliError, isProblemDetail, parseProblemDetail } from "../errors/index.js";
import { client as authClient } from "./generated/auth/client.gen.js";
import { client as pathClient } from "./generated/path/client.gen.js";

let interceptorsRegistered = false;

export function configureClients(options: {
  baseUrl: string;
  auth: () => Promise<string | undefined>;
}): void {
  for (const client of [authClient, pathClient]) {
    client.setConfig({
      baseUrl: options.baseUrl,
      auth: options.auth,
    });
  }

  if (interceptorsRegistered) return;
  interceptorsRegistered = true;

  for (const client of [authClient, pathClient]) {
    client.interceptors.response.use(async (response) => {
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
