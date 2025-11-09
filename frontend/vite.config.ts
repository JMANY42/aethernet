import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
           tailwindcss()],
  // Development proxy: forward /api requests to the backend server running
  // on localhost:5000 so fetch('/api/...') resolves to the Express proxy routes.
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        // preserve path, let backend handle routing
      },
    },
  },
})
