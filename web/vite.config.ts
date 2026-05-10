import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Vite serves the dev UI on this port. There are two valid dev topologies:
//
//   1. `pnpm dev` standalone (recommended for fast iteration):
//      Open http://127.0.0.1:5173. Vite serves HMR + assets, and every
//      `/api/*` request is reverse-proxied to a running `boson serve`
//      instance (defaults to http://127.0.0.1:8787). Override the upstream
//      with `BOSON_API_URL=http://127.0.0.1:9000 pnpm dev`.
//
//   2. `boson dev` (used for first-run / packaged demos):
//      Open http://127.0.0.1:8787. The Rust server reverse-proxies HTML +
//      HMR websockets to this Vite instance and serves `/api/*` directly.
const VITE_DEV_PORT = Number(process.env.VITE_DEV_PORT ?? 5173);
const BOSON_API_URL = process.env.BOSON_API_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: VITE_DEV_PORT,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      // All Boson backend traffic lives under `/api`. Forward it to the
      // running Rust server so the browser keeps talking to Vite (no CORS
      // hop), and HMR + live API requests work side-by-side.
      "/api": {
        target: BOSON_API_URL,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
