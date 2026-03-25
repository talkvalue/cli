/**
 * Verifies every query param in generated OpenAPI types has a Commander .option().
 * Parses types.gen.ts → extracts *Data query fields → compares against CLI program.
 *
 * WHEN THIS FAILS: a param was added to the API spec but not to the CLI command.
 * FIX: add the missing .option() in the command file.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Command } from "commander";
import { describe, expect, it } from "vitest";

const TYPES_PATH = resolve(import.meta.dirname, "../../src/api/generated/path/types.gen.ts");
const typesSource = readFileSync(TYPES_PATH, "utf8");

interface EndpointSpec {
  typeName: string;
  queryParams: string[];
}

function parseQueryParams(): Map<string, EndpointSpec> {
  const result = new Map<string, EndpointSpec>();

  // Regex extracts "export type FooData = { ... };" blocks
  const typeRegex = /export type (\w+Data) = \{([\s\S]*?)\n\};/g;

  for (const match of typesSource.matchAll(typeRegex)) {
    const typeName = match[1];
    const body = match[2];

    if (/query\?\s*:\s*never/.test(body)) continue;

    const queryMatch = body.match(/query\??\s*:\s*\{([\s\S]*?)\};/);
    if (!queryMatch) continue;

    // Extracts field names from "fieldName?: Type" patterns
    const fields = [...queryMatch[1].matchAll(/(\w+)\??\s*:/g)].map((m) => m[1]);

    if (fields.length > 0) {
      result.set(typeName, { typeName, queryParams: fields });
    }
  }

  return result;
}

const specEndpoints = parseQueryParams();

const PARAM_TO_OPTION: Record<string, string> = {
  pageNumber: "page",
  pageSize: "page-size",
  channelId: "channel-id",
  eventId: "event-id",
  companyId: "company-id",
  companyName: "company-name",
  jobTitle: "job-title",
  channelIds: "channel-id",
  eventIds: "event-id",
  timeZone: "timezone",
};

function paramToOptionName(param: string): string {
  if (PARAM_TO_OPTION[param]) return PARAM_TO_OPTION[param];
  return param.replace(/([A-Z])/g, "-$1").toLowerCase();
}

const ENDPOINT_TO_COMMAND: Record<string, string[]> = {
  ListPeopleData: ["path", "person", "list"],
  ListEventPeopleData: ["path", "event", "person", "list"],
  ListChannelPeopleData: ["path", "channel", "people"],
  ListCompanyPeopleData: ["path", "company", "person", "list"],
  ListCompaniesData: ["path", "company", "list"],
  ListImportJobsData: ["path", "import", "list"],
  GetActivityData: ["path", "person", "activity"],
  GetStatsData: ["path", "overview", "stats"],
  GetChannelEventContributionData: ["path", "analysis", "channel", "attribution"],
  GetChannelOverlapData: ["path", "analysis", "channel", "audience"],
};

function findCommand(root: Command, path: string[]): Command | null {
  let current = root;
  for (const segment of path) {
    const sub = current.commands.find((c) => c.name() === segment);
    if (!sub) return null;
    current = sub;
  }
  return current;
}

function getRegisteredOptions(cmd: Command): Set<string> {
  return new Set(
    cmd.options.map((o) => o.long?.replace(/^--/, "") ?? o.short?.replace(/^-/, "") ?? ""),
  );
}

let _program: Command | null = null;

async function getProgram(): Promise<Command> {
  if (_program) return _program;
  const { createProgram } = await import("../../src/cli.js");
  _program = createProgram();
  return _program;
}

describe("API query param → CLI option coverage", () => {
  it("types.gen.ts was parsed successfully", () => {
    expect(specEndpoints.size).toBeGreaterThan(0);
    expect(specEndpoints.has("ListPeopleData")).toBe(true);
  });

  it("all mapped endpoints exist in the parsed spec", () => {
    for (const typeName of Object.keys(ENDPOINT_TO_COMMAND)) {
      expect(specEndpoints.has(typeName), `${typeName} not found in types.gen.ts`).toBe(true);
    }
  });

  for (const [typeName, commandPath] of Object.entries(ENDPOINT_TO_COMMAND)) {
    const spec = specEndpoints.get(typeName);
    if (!spec) continue;

    it(`${commandPath.join(" ")} covers all query params from ${typeName}`, async () => {
      const program = await getProgram();
      const cmd = findCommand(program, commandPath);
      expect(cmd, `Command not found: ${commandPath.join(" ")}`).not.toBeNull();

      if (!cmd) throw new Error(`Command not found: ${commandPath.join(" ")}`);
      const registeredOptions = getRegisteredOptions(cmd);
      const missing: string[] = [];

      for (const param of spec.queryParams) {
        const expectedOption = paramToOptionName(param);
        if (!registeredOptions.has(expectedOption)) {
          missing.push(`--${expectedOption} (spec: ${param})`);
        }
      }

      expect(missing, `Missing CLI options for ${typeName}:\n  ${missing.join("\n  ")}`).toEqual(
        [],
      );
    });
  }

  it("no unmapped endpoints with query params exist", () => {
    const unmapped: string[] = [];
    for (const [typeName, spec] of specEndpoints) {
      if (!ENDPOINT_TO_COMMAND[typeName]) {
        unmapped.push(`${typeName} (${spec.queryParams.join(", ")})`);
      }
    }

    expect(
      unmapped,
      `Unmapped endpoints with query params:\n  ${unmapped.join("\n  ")}\n\nAdd to ENDPOINT_TO_COMMAND in api-coverage.test.ts`,
    ).toEqual([]);
  });
});
