import { describe, expect, it } from "vitest";
import {
  AuthError,
  CliError,
  ForbiddenError,
  NotFoundError,
  isProblemDetail,
  parseProblemDetail,
} from "../../../src/errors/index.js";

describe("isProblemDetail", () => {
  it("returns true for valid problem detail payload", () => {
    const body: unknown = {
      detail: "Token is expired",
      status: 401,
      title: "Unauthorized",
      type: "https://example.com/problems/auth",
    };

    expect(isProblemDetail(body)).toBe(true);
  });

  it("returns false for payloads with missing fields", () => {
    const body: unknown = {
      detail: "Token is expired",
      status: 401,
      type: "https://example.com/problems/auth",
    };

    expect(isProblemDetail(body)).toBe(false);
  });

  it("returns false for non-object payloads", () => {
    expect(isProblemDetail("boom")).toBe(false);
  });
});

describe("parseProblemDetail", () => {
  it("maps 401 status to AuthError", () => {
    const error = parseProblemDetail({
      detail: "Token is expired",
      status: 401,
      title: "Unauthorized",
      type: "https://example.com/problems/auth",
    });

    expect(error).toBeInstanceOf(AuthError);
    expect(error.message).toBe("Token is expired");
  });

  it("maps 403 status to ForbiddenError", () => {
    const error = parseProblemDetail({
      detail: "Forbidden",
      status: 403,
      title: "Forbidden",
      type: "https://example.com/problems/forbidden",
    });

    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("maps 404 status to NotFoundError", () => {
    const error = parseProblemDetail({
      detail: "Resource not found",
      status: 404,
      title: "Not Found",
      type: "https://example.com/problems/not-found",
    });

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("maps auth error codes to AuthError", () => {
    const error = parseProblemDetail({
      detail: "Session invalid",
      errorCode: 1200,
      status: 400,
      title: "Bad Request",
      type: "https://example.com/problems/auth-code",
    });

    expect(error).toBeInstanceOf(AuthError);
  });

  it("keeps non-auth domain errors as generic CliError unless status says otherwise", () => {
    const error = parseProblemDetail({
      detail: "Path segment does not exist",
      errorCode: 2602,
      status: 400,
      title: "Bad Request",
      type: "https://example.com/problems/path",
    });

    expect(error).toBeInstanceOf(CliError);
    expect(error).not.toBeInstanceOf(NotFoundError);
  });

  it("falls back to CliError for non-problem payloads", () => {
    const error = parseProblemDetail({ invalid: true });

    expect(error).toBeInstanceOf(CliError);
    expect(error.message).toBe("Unexpected error response");
  });
});
