import { describe, expect, it } from "vitest";
import {
  AuthError,
  CliError,
  ForbiddenError,
  NotFoundError,
  UsageError,
} from "../../../src/errors/index.js";

describe("CliError", () => {
  it("uses exit code 1 by default", () => {
    const error = new CliError("something went wrong");

    expect(error.message).toBe("something went wrong");
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe("CliError");
  });

  it("serializes error details with toJSON", () => {
    const error = new CliError("something went wrong");

    expect(error.toJSON()).toEqual({
      exitCode: 1,
      message: "something went wrong",
      name: "CliError",
    });
  });
});

describe("CliError subclasses", () => {
  it("maps AuthError to exit code 3", () => {
    const error = new AuthError("auth failed");

    expect(error.exitCode).toBe(3);
    expect(error.name).toBe("AuthError");
  });

  it("maps NotFoundError to exit code 4", () => {
    const error = new NotFoundError("not found");

    expect(error.exitCode).toBe(4);
    expect(error.name).toBe("NotFoundError");
  });

  it("maps ForbiddenError to exit code 5", () => {
    const error = new ForbiddenError("forbidden");

    expect(error.exitCode).toBe(5);
    expect(error.name).toBe("ForbiddenError");
  });

  it("maps UsageError to exit code 2", () => {
    const error = new UsageError("invalid usage");

    expect(error.exitCode).toBe(2);
    expect(error.name).toBe("UsageError");
  });
});
