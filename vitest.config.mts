import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Tests share one SQLite file, so run files sequentially.
    fileParallelism: false,
    env: { DATABASE_URL: "file:./test.db" },
  },
});
