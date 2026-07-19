import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Vite bakes VITE_* vars into the bundle at build time, not runtime — a missing
  // value here would otherwise only surface as a broken admin panel in production
  // with no error anywhere. Fail the build itself rather than shipping that.
  if (command === "build" && !env.VITE_API_URL) {
    throw new Error(
      "VITE_API_URL is not set. Vite bakes this in at build time, not runtime — " +
      "it must be set before running the build, e.g.:\n" +
      "  VITE_API_URL=https://api.innflo.co pnpm build"
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
  };
});
