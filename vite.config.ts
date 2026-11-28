import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// scripts/entries.mjs が作る entries/deadlock-report/ 以下の index.html
// （目次・N/・stats/・team/xxx/ など、階層の深さに関係なく）を全部ビルド対象にする
const root = resolve(import.meta.dirname, "entries");
const top = resolve(root, "deadlock-report");
const input: Record<string, string> = {};
const walk = (dir: string, name: string) => {
  const html = resolve(dir, "index.html");
  if (existsSync(html)) input[name] = html;
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) walk(resolve(dir, d.name), `${name}-${d.name}`);
  }
};
walk(top, "index");

export default defineConfig({
  root,
  publicDir: resolve(import.meta.dirname, "public"),
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  server: { fs: { allow: [import.meta.dirname] } },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    // 公開されるのは dist/deadlock-report/ の中だけ（GitHub Actions がそこを Pages に上げる）
    assetsDir: "deadlock-report/assets",
    rollupOptions: { input },
  },
});
