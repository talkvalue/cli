import type { ColumnDef, Formatter, OutputContext } from "./formatter.js";

export class CsvFormatter implements Formatter {
  output(data: Record<string, unknown>, _ctx: OutputContext): void {
    const columns = Object.keys(data).map((key) => ({
      header: key,
      key,
    }));

    const lines = this.renderRows([data], columns);
    process.stdout.write(`${lines.join("\n")}\n`);
  }

  list(items: Record<string, unknown>[], columns: ColumnDef[], _ctx: OutputContext): void {
    const lines = this.renderRows(items, columns);
    process.stdout.write(`${lines.join("\n")}\n`);
  }

  error(error: Error, _ctx: OutputContext): void {
    const lines = this.renderRows(
      [
        {
          error: error.name,
          message: error.message,
        },
      ],
      [
        { header: "error", key: "error" },
        { header: "message", key: "message" },
      ],
    );

    process.stderr.write(`${lines.join("\n")}\n`);
  }

  private renderRows(
    items: Record<string, unknown>[],
    columns: Pick<ColumnDef, "header" | "key">[],
  ): string[] {
    const lines: string[] = [];
    const header = columns.map((column) => this.escapeCsv(column.header)).join(",");
    lines.push(header);

    for (const item of items) {
      const row = columns
        .map((column) => {
          const value = item[column.key];
          return this.escapeCsv(this.stringifyValue(value));
        })
        .join(",");

      lines.push(row);
    }

    return lines;
  }

  private escapeCsv(value: string): string {
    const escaped = value.replaceAll('"', '""');

    if (
      escaped.includes(",") ||
      escaped.includes('"') ||
      escaped.includes("\n") ||
      escaped.includes("\r")
    ) {
      return `"${escaped}"`;
    }

    return escaped;
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }
}
