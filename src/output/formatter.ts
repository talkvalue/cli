import { CsvFormatter } from "./csv.js";
import { JsonFormatter } from "./json.js";
import { TableFormatter } from "./table.js";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
}

export interface OutputContext {
  pagination?: PaginationMeta;
}

export interface ColumnDef {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "right";
  format?: (value: unknown) => string;
}

export interface Formatter {
  output(data: Record<string, unknown>, ctx: OutputContext): void;
  list(items: Record<string, unknown>[], columns: ColumnDef[], ctx: OutputContext): void;
  error(error: Error, ctx: OutputContext): void;
}

export function createFormatter(format: string): Formatter {
  const normalized = format.toLowerCase();

  if (normalized === "json") {
    return new JsonFormatter();
  }

  if (normalized === "table") {
    return new TableFormatter();
  }

  if (normalized === "csv") {
    return new CsvFormatter();
  }

  throw new Error(`Unsupported output format: ${format}`);
}
