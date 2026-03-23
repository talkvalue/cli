import { describe, expect, it } from "vitest";

import {
  CsvFormatter,
  JsonFormatter,
  TableFormatter,
  createFormatter,
} from "../../../src/output/index.js";

describe("createFormatter", () => {
  it("creates a json formatter", () => {
    const formatter = createFormatter("json");

    expect(formatter).toBeInstanceOf(JsonFormatter);
  });

  it("creates a table formatter", () => {
    const formatter = createFormatter("table");

    expect(formatter).toBeInstanceOf(TableFormatter);
  });

  it("creates a csv formatter", () => {
    const formatter = createFormatter("csv");

    expect(formatter).toBeInstanceOf(CsvFormatter);
  });

  it("accepts mixed-case format names", () => {
    const formatter = createFormatter("JsOn");

    expect(formatter).toBeInstanceOf(JsonFormatter);
  });

  it("throws for unknown formats", () => {
    expect(() => createFormatter("yaml")).toThrowError("Unsupported output format: yaml");
  });
});
