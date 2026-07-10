import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
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
});
