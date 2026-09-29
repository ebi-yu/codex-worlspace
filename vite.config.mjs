import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const repositoryRootDirectory = resolve(import.meta.dirname);

// 1. Chromeが固定pathで読む静的assetを、追加dependencyなしで明示的にcopyする。
function copyChromeExtensionStaticAssets() {
  return {
    name: "copy-extension-assets",
    async closeBundle() {
      const extensionBuildDirectory = resolve(
        repositoryRootDirectory,
        "build/extension",
      );
      await cp(
        resolve(repositoryRootDirectory, "extension/manifest.json"),
        resolve(extensionBuildDirectory, "manifest.json"),
      );
      await mkdir(resolve(extensionBuildDirectory, "src/options"), {
        recursive: true,
      });
      await Promise.all(
        ["options.html", "options.css"].map((staticAssetFileName) =>
          cp(
            resolve(
              repositoryRootDirectory,
              "extension/src/options",
              staticAssetFileName,
            ),
            resolve(
              extensionBuildDirectory,
              "src/options",
              staticAssetFileName,
            ),
          ),
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
        "src/background/service-worker": resolve(
          repositoryRootDirectory,
          "extension/src/background/service-worker.ts",
        ),
        "src/content/content-script": resolve(
          repositoryRootDirectory,
          "extension/src/content/content-script.ts",
        ),
        "src/options/options": resolve(
          repositoryRootDirectory,
          "extension/src/options/options.ts",
        ),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "src/shared/[name]-[hash].js",
      },
    },
  },
  plugins: [copyChromeExtensionStaticAssets()],
});
