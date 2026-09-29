import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(import.meta.dirname);

/**
 * Chrome loads the manifest and options assets by fixed paths. Keeping this
 * explicit avoids a general-purpose copy dependency and makes the package
 * boundary reviewable in one place.
 */
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
