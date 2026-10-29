import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Development mein /api ki requests backend (3001) ko bhej do, taake CORS ka masla na ho
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
