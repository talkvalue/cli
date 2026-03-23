import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type TestEnvironment,
  cleanupTestEnvironment,
  createTestEnvironment,
  runCli,
} from "../helpers/cli-runner.js";

describe("CLI e2e", () => {
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    testEnv = await createTestEnvironment({
      active_profile: "dev",
      profiles: {
        dev: {
          auth_method: "oauth",
          member_email: "dev@example.com",
          org_id: "org_dev",
          org_name: "Dev Org",
        },
      },
    });
  });

  afterAll(async () => {
    await cleanupTestEnvironment(testEnv);
  });

  it("shows help", async () => {
    const result = await runCli(["--help"], testEnv);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TalkValue CLI");
    expect(result.stdout).toContain("auth");
    expect(result.stdout).toContain("path");
  });

  it("runs version command", async () => {
    const result = await runCli(["--format", "json", "version"], testEnv);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(String(result.stdout)) as { data: { version: string } };
    expect(parsed.data.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
