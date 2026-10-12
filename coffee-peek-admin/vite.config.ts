import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL?.trim();

  return {
    server: {
      port: parseInt(process.env.PORT || '5174'),
      strictPort: true,
      host: '0.0.0.0',
      proxy: apiTarget
        ? {
            '/backend': {
              target: apiTarget,
              changeOrigin: true,
              secure: true,
              ws: true,
              rewrite: (requestPath) => requestPath.replace(/^\/backend/, ''),
              // Make the API refresh cookie valid for the local Vite origin.
              cookieDomainRewrite: '',
              cookiePathRewrite: '/',
            },
          }
        : undefined,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-router': ['react-router-dom'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-form': ['react-hook-form', 'zod'],
          },
        },
      },
    },
  };
});
