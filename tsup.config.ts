import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node24",
  platform: "node",
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  define: {
    CLI_VERSION: JSON.stringify(pkg.version),
  },
  dts: false,
  sourcemap: true,
  splitting: false,
  shims: false,
});
