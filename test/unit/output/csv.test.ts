import { describe, expect, it, vi } from "vitest";

import { CsvFormatter } from "../../../src/output/csv.js";

describe.sequential("CsvFormatter", () => {
  it("outputs header and rows for list values", () => {
    const formatter = new CsvFormatter();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.list(
        [
          { id: "1", name: "Alice" },
          { id: "2", name: "Bob" },
        ],
        [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
        ],
        {},
      );

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const written = typeof value === "string" ? value : String(value);

      expect(written).toContain("ID,Name");
      expect(written).toContain("1,Alice");
      expect(written).toContain("2,Bob");
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("escapes commas, quotes, and newlines", () => {
    const formatter = new CsvFormatter();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.output(
        {
          id: "1",
          note: 'hello, "quoted"\nworld',
        },
        {},
      );

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const written = typeof value === "string" ? value : String(value);

      expect(written).toContain("id,note");
      expect(written).toContain('1,"hello, ""quoted""\nworld"');
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("prints simple error csv", () => {
    const formatter = new CsvFormatter();
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      formatter.error(new Error("oops"), {
        command: "contacts:list",
        timestamp: "2026-03-20T00:00:00.000Z",
      });

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const written = typeof value === "string" ? value : String(value);

      expect(written).toContain("error,message");
      expect(written).toContain("Error,oops");
    } finally {
      writeSpy.mockRestore();
    }
  });
});
