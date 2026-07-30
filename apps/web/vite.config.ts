import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      devOptions: { enabled: true },
      manifest: {
        id: "/housekeeping/mobile",
        name: "InnFlo Housekeeping",
        short_name: "Housekeeping",
        description: "InnFlo housekeeping task management",
        theme_color: "#E0532B",
        background_color: "#F5EBE4",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/housekeeping/mobile",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Push and offline caching must share one root-scoped registration.
        // Registering sw-push.js separately at "/" caused it and Workbox's
        // sw.js to repeatedly replace each other on mobile devices.
        importScripts: ["/sw-push.js"],
        runtimeCaching: [
          // Housekeeping: longer cache + faster fallback (field staff go offline often)
          {
            urlPattern: /\/api\/housekeeping/,
            handler: "NetworkFirst",
            options: {
              cacheName: "hk-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // All other read API routes: fall back to cache after 8s on slow connection
          {
            urlPattern: /\/api\/(reservations|rooms|guests|dashboard|hotels|maintenance|reports|groups|folio|billing|notifications|inventory|pos|qr-orders|shifts|settings|users)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "pms-api",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 4 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@":       path.resolve(__dirname, "./src"),
      "@pms/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
