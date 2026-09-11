import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Keeps `pnpm dev` on 5200 as before, but lets a supervisor place the
    // server on a free port instead of colliding with an existing one.
    port: Number(process.env.PORT) || 5200,
  },
});
