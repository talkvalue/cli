import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyringStore = new Map<string, string>();
let keyringAvailable = true;

vi.mock("@napi-rs/keyring", () => {
  class MockAsyncEntry {
    private readonly service: string;
    private readonly username: string;

    public constructor(service: string, username: string) {
      this.service = service;
      this.username = username;
    }

    public async getPassword(): Promise<string | undefined> {
      if (!keyringAvailable) {
        throw new Error("Keyring unavailable");
      }

      return keyringStore.get(`${this.service}:${this.username}`);
    }

    public async setPassword(password: string): Promise<void> {
      if (!keyringAvailable) {
        throw new Error("Keyring unavailable");
      }

      keyringStore.set(`${this.service}:${this.username}`, password);
    }

    public async deleteCredential(): Promise<boolean> {
      if (!keyringAvailable) {
        throw new Error("Keyring unavailable");
      }

      return keyringStore.delete(`${this.service}:${this.username}`);
    }
  }

  return { AsyncEntry: MockAsyncEntry };
});

describe("keyring store", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let testDir = "";

  beforeEach(async () => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    testDir = await mkdtemp(join(tmpdir(), "talkvalue-keyring-test-"));
    process.env.XDG_CONFIG_HOME = testDir;
    process.env.HOME = join(testDir, "home");
    keyringAvailable = true;
    keyringStore.clear();
    vi.resetModules();
  });

  afterEach(async () => {
    process.env = originalEnv;

    if (testDir) {
      await rm(testDir, { force: true, recursive: true });
    }
  });

  it("uses system keyring when available", async () => {
    const {
      KEYRING_FALLBACK_FILE_NAME,
      KEYRING_SERVICE_NAME,
      deleteCredential,
      getCredential,
      setCredential,
    } = await import("../../../src/auth/keyring.js");
    const { getConfigDir } = await import("../../../src/config/paths.js");

    await setCredential("talkvalue:dev:access_token", "access-token");

    expect(await getCredential("talkvalue:dev:access_token")).toBe("access-token");
    expect(keyringStore.get(`${KEYRING_SERVICE_NAME}:talkvalue:dev:access_token`)).toBe(
      "access-token",
    );

    await deleteCredential("talkvalue:dev:access_token");
    expect(await getCredential("talkvalue:dev:access_token")).toBeUndefined();

    const fallbackPath = join(getConfigDir(), KEYRING_FALLBACK_FILE_NAME);
    await expect(access(fallbackPath, constants.F_OK)).rejects.toBeDefined();
  });

  it("falls back to file storage when keyring probe fails", async () => {
    keyringAvailable = false;
    const { KEYRING_FALLBACK_FILE_NAME, getCredential, setCredential } = await import(
      "../../../src/auth/keyring.js"
    );
    const { getConfigDir } = await import("../../../src/config/paths.js");

    await setCredential("talkvalue:dev:refresh_token", "refresh-token");

    expect(await getCredential("talkvalue:dev:refresh_token")).toBe("refresh-token");

    const fallbackPath = join(getConfigDir(), KEYRING_FALLBACK_FILE_NAME);
    const fileMode = (await stat(fallbackPath)).mode & 0o777;
    expect(fileMode).toBe(0o600);

    const parsed = JSON.parse(await readFile(fallbackPath, "utf8")) as Record<string, string>;
    expect(parsed).toEqual({ "talkvalue:dev:refresh_token": "refresh-token" });
  });

  it("keeps using file fallback after first probe failure", async () => {
    keyringAvailable = false;
    const { KEYRING_FALLBACK_FILE_NAME, setCredential } = await import(
      "../../../src/auth/keyring.js"
    );
    const { getConfigDir } = await import("../../../src/config/paths.js");

    await setCredential("talkvalue:dev:access_token", "first-token");

    keyringAvailable = true;
    await setCredential("talkvalue:dev:id_token", "second-token");

    expect(keyringStore.size).toBe(0);

    const fallbackPath = join(getConfigDir(), KEYRING_FALLBACK_FILE_NAME);
    const parsed = JSON.parse(await readFile(fallbackPath, "utf8")) as Record<string, string>;
    expect(parsed).toEqual({
      "talkvalue:dev:access_token": "first-token",
      "talkvalue:dev:id_token": "second-token",
    });
  });

  it("warns and clears credentials when fallback store is corrupted", async () => {
    keyringAvailable = false;
    const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { KEYRING_FALLBACK_FILE_NAME, getCredential } = await import(
      "../../../src/auth/keyring.js"
    );
    const { ensureConfigDir, getConfigDir } = await import("../../../src/config/paths.js");
    const { writeFile } = await import("node:fs/promises");

    await ensureConfigDir();
    const fallbackPath = join(getConfigDir(), KEYRING_FALLBACK_FILE_NAME);
    await writeFile(fallbackPath, "{bad json", "utf8");

    const credential = await getCredential("talkvalue:dev:access_token");

    expect(credential).toBeUndefined();
    expect(stderrWrite).toHaveBeenCalledWith(
      "Warning: credential store corrupted, credentials cleared\n",
    );
    stderrWrite.mockRestore();
  });
});
