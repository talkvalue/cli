import { InvalidArgumentError } from "commander";
import { describe, expect, it } from "vitest";

import {
  collectNumber,
  collectString,
  isRecord,
  parseInteger,
  parseNumericId,
  pickDefined,
  toOutputContext,
  toOutputRecord,
} from "../../../src/shared/utils.js";

describe("shared utils", () => {
  describe("isRecord", () => {
    it("returns true for plain objects", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ value: 1 })).toBe(true);
    });

    it("returns false for null, arrays, and primitives", () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord([])).toBe(false);
      expect(isRecord("text")).toBe(false);
      expect(isRecord(123)).toBe(false);
      expect(isRecord(undefined)).toBe(false);
    });
  });

  describe("parseNumericId", () => {
    it("parses valid numeric ids", () => {
      expect(parseNumericId("42", "person id")).toBe(42);
      expect(parseNumericId("0007", "channel id")).toBe(7);
    });

    it("throws InvalidArgumentError on invalid numeric ids", () => {
      expect(() => parseNumericId("", "person id")).toThrow(InvalidArgumentError);
      expect(() => parseNumericId("NaN", "person id")).toThrow("Invalid person id: NaN");
      expect(() => parseNumericId("abc", "person id")).toThrow("Invalid person id: abc");
    });
  });

  describe("parseInteger", () => {
    it("parses valid integer strings", () => {
      expect(parseInteger("10", "page size")).toBe(10);
      expect(parseInteger("-3", "offset")).toBe(-3);
    });

    it("throws InvalidArgumentError for non-numeric strings", () => {
      expect(() => parseInteger("", "count")).toThrow(InvalidArgumentError);
      expect(() => parseInteger("not-a-number", "count")).toThrow("Invalid count: not a number");
    });
  });

  describe("toOutputRecord", () => {
    it("creates a shallow record copy", () => {
      const source = { a: 1, b: "x", c: null };
      const result = toOutputRecord(source);

      expect(result).toEqual({ a: 1, b: "x", c: null });
      expect(result).not.toBe(source);
    });
  });

  describe("toOutputContext", () => {
    it("returns context with pagination when provided", () => {
      const pagination = { page: 1, pageSize: 20, totalElements: 40, totalPages: 2 };
      expect(toOutputContext(pagination)).toEqual({ pagination });
    });

    it("returns context with undefined pagination when omitted", () => {
      expect(toOutputContext()).toEqual({ pagination: undefined });
    });
  });

  describe("collectNumber", () => {
    it("appends parsed integer values", () => {
      const collect = collectNumber("id");
      expect(collect("5", [1, 2])).toEqual([1, 2, 5]);
    });

    it("throws on invalid numeric input", () => {
      const collect = collectNumber("id");
      expect(() => collect("NaN", [])).toThrow(InvalidArgumentError);
      expect(() => collect("NaN", [])).toThrow("Invalid id: not a number");
    });
  });

  describe("collectString", () => {
    it("appends provided strings including empty string", () => {
      expect(collectString("next", ["prev"])).toEqual(["prev", "next"]);
      expect(collectString("", ["prev"])).toEqual(["prev", ""]);
    });
  });

  describe("pickDefined", () => {
    it("removes only undefined keys", () => {
      const result = pickDefined({
        a: 1,
        b: undefined,
        c: null,
        d: "",
        e: Number.NaN,
        f: false,
      });

      expect(result).toEqual({
        a: 1,
        c: null,
        d: "",
        e: Number.NaN,
        f: false,
      });
      expect(Object.prototype.hasOwnProperty.call(result, "b")).toBe(false);
    });
  });
});
