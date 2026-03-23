import { describe, expect, it, vi } from "vitest";

import { TableFormatter } from "../../../src/output/table.js";

describe.sequential("TableFormatter", () => {
  it("renders rows with aligned columns", () => {
    const formatter = new TableFormatter();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.list(
        [
          { id: "1", name: "Alice", score: 12 },
          { id: "22", name: "Bob", score: 3 },
        ],
        [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { align: "right", key: "score", header: "Score" },
        ],
        {},
      );

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const written = typeof value === "string" ? value : String(value);

      expect(written).toContain("ID");
      expect(written).toContain("Name");
      expect(written).toContain("Score");
      expect(written).toContain("Alice");
      expect(written).toContain("Bob");
      expect(written).toContain(" 12");
      expect(written).toContain("  3");
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("renders single-object output as key value table", () => {
    const formatter = new TableFormatter();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.output(
        {
          id: "u_1",
          status: "active",
        },
        {},
      );

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const written = typeof value === "string" ? value : String(value);

      expect(written).toContain("id");
      expect(written).toContain("u_1");
      expect(written).toContain("status");
      expect(written).toContain("active");
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("renders errors", () => {
    const formatter = new TableFormatter();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.error(new Error("bad request"), {});

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const written = typeof value === "string" ? value : String(value);

      expect(written).toContain("Error");
      expect(written).toContain("bad request");
    } finally {
      writeSpy.mockRestore();
    }
  });
});
