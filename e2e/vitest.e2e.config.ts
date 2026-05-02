import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["e2e/**/*.e2e.test.ts"],
    // E2E tests hit a real validator — give them room to confirm transactions.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Run E2E files SERIALLY: they share on-chain state (protocol PDA,
    // market PDA, deployer's USDC balance), and concurrent runs hit
    // blockhash collisions and ATA-creation races on the same accounts.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
