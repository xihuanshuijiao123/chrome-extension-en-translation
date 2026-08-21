import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFileSync, rmSync, mkdirSync } from "node:fs";

const rootDir = import.meta.dirname;

// 主构建：Sidebar 与 Options 两个 React 页面（HTML 入口）
// 使用绝对路径引用资源（在扩展根下解析），并将 dist/src/sidebar/index.html、dist/src/options/index.html
// 扁平化为 dist/sidebar.html、dist/options.html
export default defineConfig({
  plugins: [
    react(),
    {
      name: "flatten-html",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync("dist/src/sidebar/index.html", "dist/sidebar.html");
        copyFileSync("dist/src/options/index.html", "dist/options.html");
        rmSync("dist/src", { recursive: true, force: true });
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidebar: resolve(rootDir, "src/sidebar/index.html"),
        options: resolve(rootDir, "src/options/index.html"),
      },
    },
  },
});
