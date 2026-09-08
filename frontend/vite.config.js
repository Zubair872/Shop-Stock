import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Vite ko batate hain ke Vue files (.vue) samajhne ke liye plugin use karo
export default defineConfig({
  plugins: [vue()],
});
