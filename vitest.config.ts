import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // E2E tests live under e2e/ and are excluded by default. Run them with:
    //   yarn test:e2e   (or `RUN_E2E=1 vitest run e2e`)
    // They require a Solana validator at $RPC_URL with the Anemone program
    // deployed and Kamino fixtures loaded — see e2e/README.md.
    exclude: ["node_modules", "dist", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/application/**"],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
