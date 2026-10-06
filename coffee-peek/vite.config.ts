import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const apiTarget = loadEnv(mode, process.cwd(), '').VITE_API_URL?.trim();
  return {
    server: {
      port: parseInt(process.env.PORT || "5173"),
      strictPort: true,
      host: "0.0.0.0",
      proxy: apiTarget && /^https?:\/\//.test(apiTarget) ? {
        '/backend': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          ws: true,
          rewrite: requestPath => requestPath.replace(/^\/backend/, ''),
          cookieDomainRewrite: '',
          cookiePathRewrite: '/',
        },
      } : undefined,
    },
    plugins: [react()],
    optimizeDeps: {
      exclude: ["maplibre-gl"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-router': ['react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
          },
        },
      },
    },
  };
});
