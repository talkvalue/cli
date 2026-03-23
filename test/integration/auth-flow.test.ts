import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mkdtemp, rm } from "node:fs/promises";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthLoginCommand } from "../../src/commands/auth/login.js";
import { createAuthStatusCommand } from "../../src/commands/auth/status.js";
import { createAuthSwitchCommand } from "../../src/commands/auth/switch.js";

// ---------------------------------------------------------------------------
// Force keyring to use file fallback by making the native keyring probe fail.
// This lets the real file-based token storage run against the temp directory.
// ---------------------------------------------------------------------------

vi.mock("@napi-rs/keyring", () => ({
  AsyncEntry: class {
    async getPassword(): Promise<never> {
      throw new Error("keyring unavailable in test");
    }
    async setPassword(): Promise<never> {
      throw new Error("keyring unavailable in test");
    }
    async deleteCredential(): Promise<never> {
      throw new Error("keyring unavailable in test");
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock external HTTP calls — device-flow (WorkOS), API auth, and prompt
// ---------------------------------------------------------------------------

vi.mock("../../src/auth/device-flow.js", () => ({
  authenticateWithRefreshToken: vi.fn(),
  openVerificationUri: vi.fn().mockReturnValue(false),
  pollForToken: vi.fn(),
  requestDeviceCode: vi.fn(),
}));

vi.mock("../../src/api/auth.js", () => ({
  getAuthOverview: vi.fn(),
  getOrganizations: vi.fn(),
}));

vi.mock("../../src/shared/prompt.js", () => ({
  selectOrganization: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import the mocked modules so we can configure their return values
// ---------------------------------------------------------------------------

import { getAuthOverview, getOrganizations } from "../../src/api/auth.js";
import {
  authenticateWithRefreshToken,
  openVerificationUri,
  pollForToken,
  requestDeviceCode,
} from "../../src/auth/device-flow.js";
import { selectOrganization } from "../../src/shared/prompt.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMP_PREFIX = "tv-integ-auth-";

/** Build a minimal JWT with the given payload (no signature verification). */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.nosig`;
}

const ORG_A = { id: "org_aaa111", name: "Alpha Corp" };
const ORG_B = { id: "org_bbb222", name: "Beta Inc" };

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("integration: auth flow (login -> status -> switch)", () => {
  let tempConfigHome: string;
  let savedEnv: Record<string, string | undefined>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Create isolated temp config directory
    tempConfigHome = await mkdtemp(join(tmpdir(), TEMP_PREFIX));

    // Save env vars we will override
    savedEnv = {
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      TALKVALUE_DISABLE_BROWSER_OPEN: process.env.TALKVALUE_DISABLE_BROWSER_OPEN,
      NO_COLOR: process.env.NO_COLOR,
      TALKVALUE_TOKEN: process.env.TALKVALUE_TOKEN,
      TALKVALUE_API_URL: process.env.TALKVALUE_API_URL,
      TALKVALUE_AUTH_API_URL: process.env.TALKVALUE_AUTH_API_URL,
      TALKVALUE_PROFILE: process.env.TALKVALUE_PROFILE,
    };

    // Point config/keyring at temp directory; disable browser open
    process.env.XDG_CONFIG_HOME = tempConfigHome;
    process.env.TALKVALUE_DISABLE_BROWSER_OPEN = "1";
    process.env.NO_COLOR = "1";
    // biome-ignore lint/performance/noDelete: need undefined, not empty string
    delete process.env.TALKVALUE_TOKEN;
    // biome-ignore lint/performance/noDelete: need undefined, not empty string
    delete process.env.TALKVALUE_API_URL;
    // biome-ignore lint/performance/noDelete: need undefined, not empty string
    delete process.env.TALKVALUE_AUTH_API_URL;
    // biome-ignore lint/performance/noDelete: need undefined, not empty string
    delete process.env.TALKVALUE_PROFILE;

    // Suppress console.error output from commands
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    errorSpy.mockRestore();

    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Clean up temp directory
    await rm(tempConfigHome, { force: true, recursive: true });
  });

  it("login creates profile and tokens, status reads them, switch updates org", async () => {
    // -----------------------------------------------------------------------
    // 1. LOGIN
    // -----------------------------------------------------------------------

    // Set up device code mock
    vi.mocked(requestDeviceCode).mockResolvedValue({
      device_code: "dev_code_abc",
      expires_in: 600,
      interval: 1,
      user_code: "ABCD-1234",
      verification_uri: "https://auth.example.com/activate",
      verification_uri_complete: "https://auth.example.com/activate?code=ABCD-1234",
    });

    vi.mocked(openVerificationUri).mockReturnValue(false);

    // pollForToken returns initial (non-org-scoped) tokens
    const initialAccessToken = fakeJwt({
      sub: "user_999",
      email: "alice@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    vi.mocked(pollForToken).mockResolvedValue({
      access_token: initialAccessToken,
      expires_in: 3600,
      id_token: fakeJwt({
        sub: "user_999",
        email: "alice@example.com",
      }),
      refresh_token: "refresh_initial_abc",
      token_type: "Bearer",
    });

    // getOrganizations returns 2 orgs
    vi.mocked(getOrganizations).mockResolvedValue([ORG_A, ORG_B]);

    // selectOrganization auto-selects the first org
    vi.mocked(selectOrganization).mockResolvedValue(ORG_A);

    // authenticateWithRefreshToken returns org-scoped token
    const orgScopedAccessToken = fakeJwt({
      sub: "user_999",
      email: "alice@example.com",
      org_id: ORG_A.id,
      exp: Math.floor(Date.now() / 1000) + 7200,
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: orgScopedAccessToken,
      expires_in: 7200,
      id_token: fakeJwt({
        sub: "user_999",
        email: "alice@example.com",
        org_id: ORG_A.id,
      }),
      refresh_token: "refresh_org_scoped_abc",
      token_type: "Bearer",
    });

    // Run login command
    const loginRoot = new Command();
    loginRoot.name("talkvalue");
    loginRoot.addCommand(createAuthLoginCommand());
    await loginRoot.parseAsync(["node", "test", "login"]);

    // Verify: profile created on disk
    const configDir = join(tempConfigHome, "talkvalue");
    const configContent = await readFile(join(configDir, "config.yml"), "utf8");

    expect(configContent).toContain("active_profile: alice");
    expect(configContent).toContain("org_id: org_aaa111");
    expect(configContent).toContain("org_name: Alpha Corp");
    expect(configContent).toContain("member_email: alice@example.com");

    // Verify: tokens stored on disk (keyring fallback file)
    const keyringContent = await readFile(join(configDir, "keyring.json"), "utf8");
    const keyring = JSON.parse(keyringContent) as Record<string, string>;

    expect(keyring["talkvalue:alice:access_token"]).toBe(orgScopedAccessToken);
    expect(keyring["talkvalue:alice:refresh_token"]).toBe("refresh_org_scoped_abc");

    // Verify: device flow functions were called
    expect(requestDeviceCode).toHaveBeenCalledTimes(1);
    expect(pollForToken).toHaveBeenCalledTimes(1);
    expect(authenticateWithRefreshToken).toHaveBeenCalledTimes(1);
    expect(selectOrganization).toHaveBeenCalledTimes(1);

    // -----------------------------------------------------------------------
    // 2. STATUS
    // -----------------------------------------------------------------------

    // Reset mocks for the status step, but keep env pointing to same temp dir
    vi.mocked(getAuthOverview).mockResolvedValue({
      memberFirstName: "Alice",
      teamMemberCount: 5,
    });

    // Capture formatter output by spying on stdout
    const stdoutChunks: string[] = [];
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutChunks.push(String(chunk));
      return true;
    });

    const statusRoot = new Command();
    statusRoot.name("talkvalue");
    statusRoot.addCommand(createAuthStatusCommand());
    await statusRoot.parseAsync(["node", "test", "status"]);

    stdoutSpy.mockRestore();

    // The JSON formatter wraps output in { data: { ... } }
    const statusOutput = stdoutChunks.join("");
    const statusEnvelope = JSON.parse(statusOutput) as { data: Record<string, unknown> };
    const statusData = statusEnvelope.data;

    expect(statusData.profile).toBe("alice");
    expect(statusData.loggedIn).toBe(true);
    expect(statusData.orgId).toBe(ORG_A.id);
    expect(statusData.orgName).toBe("Alpha Corp");
    expect(statusData.memberEmail).toBe("alice@example.com");
    expect(statusData.memberFirstName).toBe("Alice");

    // -----------------------------------------------------------------------
    // 3. SWITCH to second org
    // -----------------------------------------------------------------------

    // getOrganizations returns same 2 orgs
    vi.mocked(getOrganizations).mockResolvedValue([ORG_A, ORG_B]);

    // selectOrganization selects the second org
    vi.mocked(selectOrganization).mockResolvedValue(ORG_B);

    // authenticateWithRefreshToken returns new org-scoped token
    const switchedAccessToken = fakeJwt({
      sub: "user_999",
      email: "alice@example.com",
      org_id: ORG_B.id,
      exp: Math.floor(Date.now() / 1000) + 7200,
    });

    vi.mocked(authenticateWithRefreshToken).mockResolvedValue({
      access_token: switchedAccessToken,
      expires_in: 7200,
      id_token: fakeJwt({
        sub: "user_999",
        email: "alice@example.com",
        org_id: ORG_B.id,
      }),
      refresh_token: "refresh_switched_xyz",
      token_type: "Bearer",
    });

    const switchStdoutChunks: string[] = [];
    const switchStdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      switchStdoutChunks.push(String(chunk));
      return true;
    });

    const switchRoot = new Command();
    switchRoot.name("talkvalue");
    switchRoot.addCommand(createAuthSwitchCommand());
    await switchRoot.parseAsync(["node", "test", "switch", ORG_B.name]);

    switchStdoutSpy.mockRestore();

    // Verify switch output (JSON envelope: { data: { ... } })
    const switchOutput = switchStdoutChunks.join("");
    const switchEnvelope = JSON.parse(switchOutput) as { data: Record<string, unknown> };
    const switchData = switchEnvelope.data;

    expect(switchData.orgId).toBe(ORG_B.id);
    expect(switchData.orgName).toBe("Beta Inc");
    expect(switchData.profile).toBe("alice");

    // Verify: config file updated with new org
    const updatedConfigContent = await readFile(join(configDir, "config.yml"), "utf8");
    expect(updatedConfigContent).toContain("org_id: org_bbb222");
    expect(updatedConfigContent).toContain("org_name: Beta Inc");

    // Verify: keyring updated with new tokens
    const updatedKeyring = JSON.parse(
      await readFile(join(configDir, "keyring.json"), "utf8"),
    ) as Record<string, string>;

    expect(updatedKeyring["talkvalue:alice:access_token"]).toBe(switchedAccessToken);
    expect(updatedKeyring["talkvalue:alice:refresh_token"]).toBe("refresh_switched_xyz");
  });
});
