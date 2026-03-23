import { CliError } from "../errors/index.js";

export function unwrap<T>(data: T | undefined, label: string): T {
  if (data === undefined) {
    throw new CliError(`Unexpected empty response from ${label}`);
  }
  return data;
}
