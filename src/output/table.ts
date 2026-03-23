import chalk from "chalk";

import type { ColumnDef, Formatter, OutputContext } from "./formatter.js";

interface ResolvedColumn {
  key: string;
  header: string;
  width: number;
  align: "left" | "right";
  format?: (value: unknown) => string;
}

export class TableFormatter implements Formatter {
  output(data: Record<string, unknown>, _ctx: OutputContext): void {
    const rows: Record<string, unknown>[] = [];

    for (const [key, value] of Object.entries(data)) {
      rows.push({ field: key, value });
    }

    const columns: ColumnDef[] = [
      { key: "field", header: "Field" },
      { key: "value", header: "Value" },
    ];

    process.stdout.write(`${this.renderTable(rows, columns)}\n`);
  }

  list(items: Record<string, unknown>[], columns: ColumnDef[], _ctx: OutputContext): void {
    process.stdout.write(`${this.renderTable(items, columns)}\n`);
  }

  error(error: Error, _ctx: OutputContext): void {
    const content = `${chalk.red.bold("Error")}: ${error.message}`;
    process.stdout.write(`${content}\n`);
  }

  private renderTable(rows: Record<string, unknown>[], columns: ColumnDef[]): string {
    const resolvedColumns = this.resolveColumns(rows, columns);
    const header = this.renderHeader(resolvedColumns);
    const separator = this.renderSeparator(resolvedColumns);

    const lines = [header, separator];

    for (const row of rows) {
      const cells: string[] = [];
      for (const column of resolvedColumns) {
        const rawValue = row[column.key];
        const text = column.format ? column.format(rawValue) : this.stringifyValue(rawValue);
        cells.push(this.pad(text, column.width, column.align));
      }
      lines.push(cells.join("  "));
    }

    return lines.join("\n");
  }

  private resolveColumns(rows: Record<string, unknown>[], columns: ColumnDef[]): ResolvedColumn[] {
    const resolved: ResolvedColumn[] = [];

    for (const column of columns) {
      const widthFromRows = rows.reduce((width, row) => {
        const rawValue = row[column.key];
        const text = column.format ? column.format(rawValue) : this.stringifyValue(rawValue);
        return Math.max(width, text.length);
      }, 0);

      const width = Math.max(column.header.length, widthFromRows, column.width ?? 0);

      resolved.push({
        align: column.align ?? "left",
        format: column.format,
        header: column.header,
        key: column.key,
        width,
      });
    }

    return resolved;
  }

  private renderHeader(columns: ResolvedColumn[]): string {
    const cells = columns.map((column) => {
      const padded = this.pad(column.header, column.width, "left");
      return chalk.cyan.bold(padded);
    });
    return cells.join("  ");
  }

  private renderSeparator(columns: ResolvedColumn[]): string {
    const cells = columns.map((column) => "-".repeat(column.width));
    return cells.join("  ");
  }

  private pad(value: string, width: number, align: "left" | "right"): string {
    if (align === "right") {
      return value.padStart(width, " ");
    }

    return value.padEnd(width, " ");
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
