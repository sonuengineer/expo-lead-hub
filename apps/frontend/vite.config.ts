import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// `base` controls the public path the app is served from. For cPanel hosting at
// rathinfotech.com/mmrd/, build with VITE_BASE_PATH=/mmrd/ (note trailing slash).
// Defaults to "/" for local dev and root hosting.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3000,
      host: true, // expose on the LAN (0.0.0.0) so phones can reach it for QR / card scanning
      allowedHosts: true, // allow tunnel hosts (cloudflared / ngrok / localtunnel) in dev
      proxy: {
        // Only the API is proxied to the backend. The public visitor route
        // `/v/:shortCode` is handled by the SPA (React Router), and it fetches
        // form data from `/api/public/v/:shortCode`.
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  };
});
