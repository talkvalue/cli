/**
 * Forbids `body: ... as <Name>Req` casts in command files.
 *
 * WHY: OpenAPI-generated *Req types have required fields (e.g. UpdateChannelReq.name).
 * The CLI used `payload as UpdateChannelReq` to silence TS, which let partial bodies
 * reach the backend — resulting in Kotlin Jackson deserialization 500 errors for
 * missing non-nullable fields. Building the payload as an explicit object literal
 * without a cast lets the compiler catch missing required fields at build time.
 *
 * WHEN THIS FAILS: someone re-introduced a `body: X as YReq` cast. Instead, construct
 * the payload as `const payload: YReq = { requiredField, ...optional };` without `as`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const COMMANDS_DIR = resolve(import.meta.dirname, "../../src/commands");
const CAST_REGEX = /body:\s*[\w.]+\s+as\s+(\w+Req)\b/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("command body payload safety", () => {
  it("no command uses `as <Name>Req` cast when constructing request body", () => {
    const violations: string[] = [];
    for (const file of walk(COMMANDS_DIR)) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(CAST_REGEX)) {
        violations.push(`${file.replace(`${process.cwd()}/`, "")}: ${match[0]}`);
      }
    }

    expect(
      violations,
      `Unsafe body cast(s) found. Replace with an explicit typed object literal so TS can verify required fields:\n  ${violations.join("\n  ")}`,
    ).toEqual([]);
  });
});
