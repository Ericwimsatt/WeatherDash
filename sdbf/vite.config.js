import { defineConfig } from "vite";

// The standalone Vite preview uses the same read-only API as the deployed app.
export default defineConfig({
  server: { proxy: { "/api": { target: "https://sdbeachfinder.gingernet.net", changeOrigin: true } } },
});
