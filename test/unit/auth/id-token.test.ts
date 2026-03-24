import { describe, expect, it } from "vitest";

import { decodeIdToken } from "../../../src/auth/id-token.js";

describe("decodeIdToken", () => {
  function makeToken(claims: Record<string, unknown>): string {
    const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `header.${encoded}.signature`;
  }

  it("extracts all claims from a valid id token", () => {
    const token = makeToken({
      email: "alice@example.com",
      org_id: "org_123",
      org_name: "Alpha Corp",
      sub: "user_456",
    });

    expect(decodeIdToken(token)).toEqual({
      email: "alice@example.com",
      org_id: "org_123",
      org_name: "Alpha Corp",
      sub: "user_456",
    });
  });

  it("returns undefined for missing optional claims", () => {
    const token = makeToken({ sub: "user_456" });

    expect(decodeIdToken(token)).toEqual({
      email: undefined,
      org_id: undefined,
      org_name: undefined,
      sub: "user_456",
    });
  });

  it("ignores empty string claims", () => {
    const token = makeToken({ email: "", sub: "" });

    expect(decodeIdToken(token)).toEqual({
      email: undefined,
      org_id: undefined,
      org_name: undefined,
      sub: undefined,
    });
  });

  it("returns undefined for an invalid token", () => {
    expect(decodeIdToken("not-a-jwt")).toBeUndefined();
  });

  it("returns undefined when payload is not an object", () => {
    const encoded = Buffer.from('"just a string"').toString("base64url");
    expect(decodeIdToken(`header.${encoded}.sig`)).toBeUndefined();
  });
});
