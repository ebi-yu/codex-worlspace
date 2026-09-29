import { defineConfig } from "vitest/config";

// 1. 実装と同じdirectoryにあるtestだけをNode.js環境で実行する。
export default defineConfig({
  test: {
    environment: "node",
    include: ["extension/src/**/*.test.ts"],
    passWithNoTests: false,
  },
});
