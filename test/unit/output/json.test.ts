import { describe, expect, it, vi } from "vitest";

import type { OutputContext } from "../../../src/output/formatter.js";
import { JsonFormatter } from "../../../src/output/json.js";

function createContext(): OutputContext {
  return {};
}

describe.sequential("JsonFormatter", () => {
  it("outputs object payload with no extra metadata", () => {
    const formatter = new JsonFormatter();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.output(
        {
          id: "123",
          name: "Jane",
        },
        createContext(),
      );

      expect(writeSpy).toHaveBeenCalledOnce();
      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const parsed = JSON.parse(typeof value === "string" ? value : String(value));
      expect(parsed).toEqual({
        data: {
          id: "123",
          name: "Jane",
        },
      });
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("outputs list payload with top-level pagination", () => {
    const formatter = new JsonFormatter();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.list(
        [
          { id: "1", name: "A" },
          { id: "2", name: "B" },
        ],
        [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
        ],
        {
          pagination: {
            page: 1,
            pageSize: 10,
            totalElements: 2,
            totalPages: 1,
          },
        },
      );

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const parsed = JSON.parse(typeof value === "string" ? value : String(value));

      expect(parsed).toEqual({
        data: [
          { id: "1", name: "A" },
          { id: "2", name: "B" },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          totalElements: 2,
          totalPages: 1,
        },
      });
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("outputs error payload", () => {
    const formatter = new JsonFormatter();
    const err = new Error("boom");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      formatter.error(err, createContext());

      const value = writeSpy.mock.calls[writeSpy.mock.calls.length - 1]?.[0];
      const parsed = JSON.parse(typeof value === "string" ? value : String(value));

      expect(parsed).toEqual({
        error: {
          message: "boom",
        },
      });
    } finally {
      writeSpy.mockRestore();
    }
  });
});
