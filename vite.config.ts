import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      // In dev, proxy /api/* to local Express backend
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    define: {
      'global': 'globalThis',
      'process.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(
        env.VITE_GOOGLE_MAPS_API_KEY || env.Maps_API_KEY || ""
      )
    },
    optimizeDeps: {
      exclude: ['groq-sdk', 'dotenv', 'node-fetch', '@google/genai']
    },
    build: {
      rollupOptions: {
        external: []
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
