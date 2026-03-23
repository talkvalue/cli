import type { ColumnDef, Formatter, OutputContext } from "./formatter.js";

interface OutputPayload {
  data: Record<string, unknown> | Record<string, unknown>[];
  pagination?: OutputContext["pagination"];
}

export class JsonFormatter implements Formatter {
  output(data: Record<string, unknown>, ctx: OutputContext): void {
    const payload: OutputPayload = {
      data,
      ...(ctx.pagination ? { pagination: ctx.pagination } : {}),
    };

    this.write(payload);
  }

  list(items: Record<string, unknown>[], _columns: ColumnDef[], ctx: OutputContext): void {
    const payload: OutputPayload = {
      data: items,
      ...(ctx.pagination ? { pagination: ctx.pagination } : {}),
    };

    this.write(payload);
  }

  error(error: Error, ctx: OutputContext): void {
    const payload = {
      error: {
        message: error.message,
      },
      ...(ctx.pagination ? { pagination: ctx.pagination } : {}),
    };

    this.write(payload);
  }

  private write(payload: object): void {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }
}
