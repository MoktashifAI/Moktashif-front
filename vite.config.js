import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/conversations': 'http://localhost:5000',
      '/chat': 'http://localhost:5000',
      '/upload': 'http://localhost:5000',
      '/file': 'http://localhost:5000',
      '/user': 'http://localhost:5000',
    },
    historyApiFallback: true
  },
})
