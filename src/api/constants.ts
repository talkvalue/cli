declare const CLI_VERSION: string;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const POLL_TIMEOUT_MS = 10_000;
export const USER_AGENT = `talkvalue-cli/${typeof CLI_VERSION !== "undefined" ? CLI_VERSION : "dev"}`;
