import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Rust writes build files into src-tauri; watching them crashes Vite on Windows.
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
