import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Figma Make 전용 플러그인은 빼고, 일반 Vite 빌드로 정리
// 개발 중에는 /api 요청을 백엔드(docker compose의 web, 8080)로 넘김
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    sourcemap: false, // 운영 이미지에 소스맵을 넣지 않음
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.API_TARGET || "http://localhost:8080", changeOrigin: false },
    },
  },
});
