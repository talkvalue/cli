import { UsageError } from "../errors/index.js";
import type { OutputContext } from "../output/index.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseNumericId(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new UsageError(`Invalid ${fieldName}: ${value}`);
  }
  return parsed;
}

export function parseInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new UsageError(`Invalid ${label}: not a number`);
  }
  return parsed;
}

export function toOutputRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

export function toOutputContext(pagination?: OutputContext["pagination"]): OutputContext {
  return { pagination };
}

export function collectNumber(label: string): (value: string, previous: number[]) => number[] {
  return (value: string, previous: number[]): number[] => {
    return [...previous, parseInteger(value, label)];
  };
}

export function collectString(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function pickDefined<TValue extends object>(value: TValue): Partial<TValue> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<TValue>;
}
