import { afterEach, describe, expect, it } from "vitest";

import { detectFormat, isTTY } from "../../../src/output/tty.js";

describe("isTTY", () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: originalIsTTY,
    });
  });

  it("returns true when stdout is a tty", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: true,
    });

    expect(isTTY()).toBe(true);
  });

  it("returns false when stdout is not a tty", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: false,
    });

    expect(isTTY()).toBe(false);
  });

  it("returns false when stdout tty is undefined", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: undefined,
    });

    expect(isTTY()).toBe(false);
  });
});

describe("detectFormat", () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: originalIsTTY,
    });
  });

  it("returns the flag value when provided", () => {
    expect(detectFormat("csv")).toBe("csv");
    expect(detectFormat("json")).toBe("json");
  });

  it("returns table when no flag and stdout is a tty", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: true,
    });

    expect(detectFormat(undefined)).toBe("table");
  });

  it("returns json when no flag and stdout is not a tty", () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: false,
    });

    expect(detectFormat(undefined)).toBe("json");
  });
});
