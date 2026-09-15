import { defineConfig } from "vite";

// Relative base so the built app also works when Electron loads it from disk (file://).
export default defineConfig({
  base: "./",
  server: { port: 5173, strictPort: true },
  build: { outDir: "dist", sourcemap: true, target: "es2022" },
});
