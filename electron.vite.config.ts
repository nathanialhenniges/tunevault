import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  main: {
    resolve: {
      alias:
        process.env.TUNEVAULT_INSTALLER_TEST === "1"
          ? [
              {
                find: /.*update\/config$/,
                replacement: resolve("src/update/installer-test-config.ts"),
              },
            ]
          : [],
    },
    build: {
      rollupOptions: {
        external: ["electron-liquid-glass"],
        input: {
          index: resolve("src/main/index.ts"),
          worker: resolve("src/worker/index.ts"),
        },
      },
    },
  },
  preload: {
    build: { rollupOptions: { input: resolve("src/preload/index.ts") } },
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    build: { rollupOptions: { input: resolve("src/renderer/index.html") } },
  },
});
