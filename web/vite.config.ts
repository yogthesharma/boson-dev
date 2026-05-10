import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite serves the dev UI on this port. The Rust server reverse-proxies
// to it (including HMR websockets) when running `boson dev`.
const VITE_DEV_PORT = Number(process.env.VITE_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    port: VITE_DEV_PORT,
    strictPort: true,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
