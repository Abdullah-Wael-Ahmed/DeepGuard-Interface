import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server:{
    port: 3000,
    host: true,
    watch:{
      usePolling:true
    },
    proxy: {
      '/api' : {
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
