import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AsyncEntry } from "@napi-rs/keyring";

import { ensureConfigDir, getConfigDir } from "../config/paths.js";
import { isRecord } from "../shared/utils.js";

export const KEYRING_FALLBACK_FILE_NAME = "keyring.json";
export const KEYRING_SERVICE_NAME = "talkvalue-cli";

type StorageBackend = "file" | "keyring";
type StoredCredentials = Record<string, string>;

let storageBackendPromise: Promise<StorageBackend> | undefined;

function getFallbackPath(): string {
  return join(getConfigDir(), KEYRING_FALLBACK_FILE_NAME);
}

function parseFallbackStore(content: string): StoredCredentials {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return {};
  }

  if (!isRecord(parsed)) {
    return {};
  }

  const credentials: StoredCredentials = {};

  for (const [account, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      credentials[account] = value;
    }
  }

  return credentials;
}

async function readFallbackStore(): Promise<StoredCredentials> {
  try {
    const content = await readFile(getFallbackPath(), "utf8");
    return parseFallbackStore(content);
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;

    if (code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeFallbackStore(credentials: StoredCredentials): Promise<void> {
  await ensureConfigDir();
  const fallbackPath = getFallbackPath();
  const serialized = JSON.stringify(credentials, null, 2);

  await writeFile(fallbackPath, serialized, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(fallbackPath, 0o600);
}

async function probeBackend(): Promise<StorageBackend> {
  try {
    const probe = new AsyncEntry(KEYRING_SERVICE_NAME, "talkvalue:probe");
    await probe.getPassword();
    return "keyring";
  } catch {
    process.stderr.write("Warning: keyring unavailable, using file storage\n");
    return "file";
  }
}

async function getStorageBackend(): Promise<StorageBackend> {
  if (!storageBackendPromise) {
    storageBackendPromise = probeBackend();
  }

  return storageBackendPromise;
}

function switchToFileFallback(): void {
  storageBackendPromise = Promise.resolve("file");
}

async function withStorageBackend<T>(actions: {
  file: () => Promise<T>;
  keyring: () => Promise<T>;
}): Promise<T> {
  const storageBackend = await getStorageBackend();

  if (storageBackend === "keyring") {
    try {
      return await actions.keyring();
    } catch {
      switchToFileFallback();
      return actions.file();
    }
  }

  return actions.file();
}

export async function getCredential(account: string): Promise<string | undefined> {
  return withStorageBackend({
    file: async () => {
      const credentials = await readFallbackStore();
      return credentials[account];
    },
    keyring: async () => {
      const entry = new AsyncEntry(KEYRING_SERVICE_NAME, account);
      return entry.getPassword();
    },
  });
}

export async function setCredential(account: string, value: string): Promise<void> {
  await withStorageBackend({
    file: async () => {
      const credentials = await readFallbackStore();
      credentials[account] = value;
      await writeFallbackStore(credentials);
    },
    keyring: async () => {
      const entry = new AsyncEntry(KEYRING_SERVICE_NAME, account);
      await entry.setPassword(value);
    },
  });
}

export async function deleteCredential(account: string): Promise<void> {
  await withStorageBackend({
    file: async () => {
      const credentials = await readFallbackStore();
      delete credentials[account];
      await writeFallbackStore(credentials);
    },
    keyring: async () => {
      const entry = new AsyncEntry(KEYRING_SERVICE_NAME, account);
      await entry.deleteCredential();
    },
  });
}
