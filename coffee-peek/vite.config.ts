import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const configuredApiUrl = loadEnv(mode, process.cwd(), '').VITE_API_URL?.trim();
  const productionApiUrl = loadEnv('production', process.cwd(), '').VITE_API_URL?.trim();
  const apiTarget = [configuredApiUrl, productionApiUrl].find(url => url && /^https?:\/\//.test(url));
  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || `local-${new Date().toISOString()}`),
    },
    server: {
      port: parseInt(process.env.PORT || "5173"),
      strictPort: true,
      host: "0.0.0.0",
      proxy: apiTarget ? {
        '/download/': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/api/support': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
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
    plugins: [react(), tailwindcss()],
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
        input: {
          main: path.resolve(__dirname, 'index.html'),
          support: path.resolve(__dirname, 'support.html'),
        },
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
