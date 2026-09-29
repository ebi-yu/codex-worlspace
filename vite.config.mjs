import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(import.meta.dirname);

// 1. Chromeが固定pathで読む静的assetを、追加dependencyなしで明示的にcopyする。
function copyExtensionAssets() {
  return {
    name: "copy-extension-assets",
    async closeBundle() {
      const output = resolve(root, "build/extension");
      await cp(resolve(root, "extension/manifest.json"), resolve(output, "manifest.json"));
      await mkdir(resolve(output, "src/options"), { recursive: true });
      await Promise.all(
        ["options.html", "options.css"].map((file) =>
          cp(resolve(root, "extension/src/options", file), resolve(output, "src/options", file)),
        ),
      );
    },
  };
}

// 2. 3つのruntime entryをmanifestと一致するpathへbuildする。
export default defineConfig({
  build: {
    outDir: "build/extension",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        "src/background/service-worker": resolve(root, "extension/src/background/service-worker.ts"),
        "src/content/content-script": resolve(root, "extension/src/content/content-script.ts"),
        "src/options/options": resolve(root, "extension/src/options/options.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "src/shared/[name]-[hash].js",
      },
    },
  },
  plugins: [copyExtensionAssets()],
});
