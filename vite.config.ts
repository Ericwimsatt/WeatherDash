import { defineConfig } from "vite";
import { octane } from "@octanejs/vite-plugin";
export default defineConfig({
  plugins: [octane()],
  server: { proxy: { "/api": "http://127.0.0.1:8788" } },
});
