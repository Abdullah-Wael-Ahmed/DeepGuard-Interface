import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: ['deepguard-frontend-dev', 'deepguard-frontend'],
    watch: {
      usePolling: true
    },
    hmr: {
      clientPort: 3000,
      host: '127.0.0.1',
      overlay: true
    },
    proxy: {
      // Dedicated rule for the PDF export: Vite's default proxy handling
      // corrupts this binary response (delivers 0 bytes as text/xml), so we
      // self-handle and pipe the raw stream through untouched.
      '/api/reports/export/pdf': {
        target: "http://backend:5000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Copy upstream headers (Content-Type, Content-Disposition, etc.)
            Object.keys(proxyRes.headers).forEach((key) => {
              res.setHeader(key, proxyRes.headers[key]);
            });
            res.statusCode = proxyRes.statusCode;
            // Pipe raw binary — never buffer or .toString() it.
            proxyRes.pipe(res);
          });
        }
      },
      '/api': {
        target: "http://backend:5000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://backend:5000', // Note the ws:// here
        ws: true,                    // This tells Vite to pass the Upgrade header
      }
    }
  }
})
