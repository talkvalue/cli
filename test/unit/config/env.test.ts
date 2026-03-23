import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveEnv } from "../../../src/config/env.js";

describe("resolveEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("token", () => {
    it("returns undefined when TALKVALUE_TOKEN is not set", () => {
      process.env.TALKVALUE_TOKEN = undefined;
      const config = resolveEnv();
      expect(config.token).toBeUndefined();
    });

    it("returns token value when TALKVALUE_TOKEN is set", () => {
      process.env.TALKVALUE_TOKEN = "test-token-123";
      const config = resolveEnv();
      expect(config.token).toBe("test-token-123");
    });
  });

  describe("apiUrl", () => {
    it("returns undefined when TALKVALUE_API_URL is not set", () => {
      process.env.TALKVALUE_API_URL = undefined;
      const config = resolveEnv();
      expect(config.apiUrl).toBeUndefined();
    });

    it("returns apiUrl value when TALKVALUE_API_URL is set", () => {
      process.env.TALKVALUE_API_URL = "https://api.example.com";
      const config = resolveEnv();
      expect(config.apiUrl).toBe("https://api.example.com");
    });
  });

  describe("authApiUrl", () => {
    it("returns undefined when TALKVALUE_AUTH_API_URL is not set", () => {
      process.env.TALKVALUE_AUTH_API_URL = undefined;
      const config = resolveEnv();
      expect(config.authApiUrl).toBeUndefined();
    });

    it("returns authApiUrl value when TALKVALUE_AUTH_API_URL is set", () => {
      process.env.TALKVALUE_AUTH_API_URL = "https://auth-api.example.com";
      const config = resolveEnv();
      expect(config.authApiUrl).toBe("https://auth-api.example.com");
    });
  });

  describe("profile", () => {
    it("returns undefined when TALKVALUE_PROFILE is not set", () => {
      process.env.TALKVALUE_PROFILE = undefined;
      const config = resolveEnv();
      expect(config.profile).toBeUndefined();
    });

    it("returns profile value when TALKVALUE_PROFILE is set", () => {
      process.env.TALKVALUE_PROFILE = "production";
      const config = resolveEnv();
      expect(config.profile).toBe("production");
    });
  });

  describe("noColor", () => {
    it("returns false when NO_COLOR is not set", () => {
      process.env.NO_COLOR = undefined;
      const config = resolveEnv();
      expect(config.noColor).toBe(false);
    });

    it("returns true when NO_COLOR is set to empty string", () => {
      process.env.NO_COLOR = "";
      const config = resolveEnv();
      expect(config.noColor).toBe(true);
    });

    it("returns true when NO_COLOR is set to any value", () => {
      process.env.NO_COLOR = "1";
      const config = resolveEnv();
      expect(config.noColor).toBe(true);
    });

    it("returns true when NO_COLOR is set to 'true'", () => {
      process.env.NO_COLOR = "true";
      const config = resolveEnv();
      expect(config.noColor).toBe(true);
    });
  });

  describe("forceColor", () => {
    it("returns false when FORCE_COLOR is not set", () => {
      process.env.FORCE_COLOR = undefined;
      const config = resolveEnv();
      expect(config.forceColor).toBe(false);
    });

    it("returns true when FORCE_COLOR is set to empty string", () => {
      process.env.FORCE_COLOR = "";
      const config = resolveEnv();
      expect(config.forceColor).toBe(true);
    });

    it("returns true when FORCE_COLOR is set to any value", () => {
      process.env.FORCE_COLOR = "1";
      const config = resolveEnv();
      expect(config.forceColor).toBe(true);
    });

    it("returns true when FORCE_COLOR is set to 'true'", () => {
      process.env.FORCE_COLOR = "true";
      const config = resolveEnv();
      expect(config.forceColor).toBe(true);
    });
  });

  describe("color resolution", () => {
    it("forceColor overrides noColor when both are set", () => {
      process.env.NO_COLOR = "1";
      process.env.FORCE_COLOR = "1";
      const config = resolveEnv();
      expect(config.noColor).toBe(true);
      expect(config.forceColor).toBe(true);
    });

    it("returns all config values together", () => {
      process.env.TALKVALUE_TOKEN = "token-123";
      process.env.TALKVALUE_API_URL = "https://api.example.com";
      process.env.TALKVALUE_AUTH_API_URL = "https://auth-api.example.com";
      process.env.TALKVALUE_PROFILE = "staging";
      process.env.NO_COLOR = "1";
      process.env.FORCE_COLOR = "1";

      const config = resolveEnv();

      expect(config).toEqual({
        token: "token-123",
        apiUrl: "https://api.example.com",
        authApiUrl: "https://auth-api.example.com",
        profile: "staging",
        noColor: true,
        forceColor: true,
      });
    });
  });
});
