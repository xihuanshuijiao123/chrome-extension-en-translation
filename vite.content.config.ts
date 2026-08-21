import { defineConfig } from "vite";
import { resolve } from "node:path";

const rootDir = import.meta.dirname;

// Content Script 构建：独立 iife 入口，产物自包含，供 manifest 直接引用
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: { content: resolve(rootDir, "src/content/index.ts") },
      formats: ["iife"],
      name: "ContentScript",
    },
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
