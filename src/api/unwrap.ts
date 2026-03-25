import { CliError } from "../errors/index.js";

export function unwrap<T>(data: T | undefined | null, label: string): T {
  if (data === undefined || data === null) {
    throw new CliError(`No ${label} data returned`);
  }
  return data;
}
