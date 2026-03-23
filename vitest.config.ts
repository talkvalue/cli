import { readFileSync } from "node:fs";
import { configDefaults, defineConfig } from "vitest/config";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

export default defineConfig({
  define: {
    CLI_VERSION: JSON.stringify(pkg.version),
  },
  test: {
    exclude: [...configDefaults.exclude],
    include: ["test/**/*.test.ts"],
    globals: true,
    restoreMocks: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts"],
    },
  },
});
