import { describe, expect, it } from "vitest";

import { decodeJwtPayload } from "../../../src/auth/jwt.js";

describe("decodeJwtPayload", () => {
  it("decodes a valid JWT payload", () => {
    const payload = { sub: "user_123", email: "test@example.com" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const token = `header.${encoded}.signature`;

    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it("returns undefined for token with fewer than 2 segments", () => {
    expect(decodeJwtPayload("single-segment")).toBeUndefined();
    expect(decodeJwtPayload("")).toBeUndefined();
  });

  it("returns undefined for invalid base64url payload", () => {
    expect(decodeJwtPayload("header.!!!invalid!!!.signature")).toBeUndefined();
  });

  it("returns undefined for non-JSON payload", () => {
    const notJson = Buffer.from("not json at all").toString("base64url");
    expect(decodeJwtPayload(`header.${notJson}.signature`)).toBeUndefined();
  });
});
