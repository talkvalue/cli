/** Initial client config for hey-api codegen. baseUrl is overridden at runtime by configureClients. */
import type { CreateClientConfig } from "./generated/auth/client.gen.js";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
});
