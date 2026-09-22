import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // PORT is assigned by the preview harness; plain `npm run dev` keeps 5173.
    port: Number(process.env.PORT) || 5173,
    // Allow ngrok / cloudflare / jprq public tunnels
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      "/media": {
        target: "http://localhost:8000",
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      // Local admin → production (same-origin; avoids CORS)
      "/prod-api": {
        target: "https://lutfanai.uz",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/prod-api/, "/api"),
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
});
